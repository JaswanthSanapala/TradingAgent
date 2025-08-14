import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { DataPipeline } from './data-pipeline';
import { BacktestEngine } from './backtest-engine';

export interface RLConfig {
  algorithm: 'ppo' | 'a2c' | 'dqn' | 'sac';
  learningRate: number;
  totalTimesteps: number;
  batchSize: number;
  gamma: number;
  explorationRate: number;
  memorySize: number;
  targetUpdateInterval: number;
}

export interface TrainingEnvironment {
  stateSize: number;
  actionSize: number;
  maxSteps: number;
  rewardThreshold: number;
}

export interface LossAnalysis {
  tradeId: string;
  lossAmount: number;
  lossReason: string;
  marketConditions: any;
  agentDecision: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
  category: string;
}

export interface RLModel {
  id: string;
  algorithm: string;
  version: number;
  parameters: any;
  performance: {
    totalReward: number;
    winRate: number;
    sharpeRatio: number;
    drawdown: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class RLTrainer {
  private config: RLConfig;
  private environment: TrainingEnvironment;
  private dataPipeline: DataPipeline;
  private backtestEngine: BacktestEngine;
  private currentModel: RLModel | null = null;
  private trainingHistory: any[] = [];
  private lossMemory: LossAnalysis[] = [];

  constructor(config: RLConfig, environment: TrainingEnvironment) {
    this.config = config;
    this.environment = environment;
    this.dataPipeline = new DataPipeline(this.getDataPipelineConfig());
    this.backtestEngine = new BacktestEngine(this.getBacktestConfig());
  }

  private getDataPipelineConfig() {
    return {
      exchange: {
        apiKey: process.env.EXCHANGE_API_KEY || '',
        secret: process.env.EXCHANGE_API_SECRET || '',
        sandbox: true,
      },
      timeframes: {
        '4h': '4h',
        '1h': '1h',
        '15m': '15m',
      },
      indicators: {
        atrPeriod: 14,
        cciPeriod: 14,
        smaPeriods: [20, 50],
        rsiPeriod: 14,
      },
      database: {
        path: './data/trading.db',
        backupEnabled: true,
        cleanupDays: 30,
      },
      symbols: ['EUR/USD', 'GBP/USD', 'USD/JPY'],
    };
  }

  private getBacktestConfig() {
    return {
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      endDate: new Date(),
      symbol: 'EUR/USD',
      initialBalance: 10000,
      maxRiskPerTrade: 0.01,
      maxTradesPerDay: 2,
      minRewardRiskRatio: 3,
    };
  }

  async trainAgent(agentId: string, strategyId: string): Promise<RLModel> {
    try {
      logger.info(`Starting RL training for agent ${agentId}`);

      // Get agent and strategy information
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { strategy: true },
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Load previous loss analysis for this agent
      await this.loadLossAnalysis(agentId);

      // Initialize or load model
      await this.initializeModel(agent);

      // Create training environment
      const trainingEnv = await this.createTrainingEnvironment(agent, strategyId);

      // Run training episodes
      const trainingResults = await this.runTrainingEpisodes(trainingEnv, agentId);

      // Evaluate trained model
      const evaluationResults = await this.evaluateModel(agentId, strategyId);

      // Update model performance
      this.currentModel!.performance = {
        totalReward: evaluationResults.totalReward,
        winRate: evaluationResults.winRate,
        sharpeRatio: evaluationResults.sharpeRatio,
        drawdown: evaluationResults.maxDrawdown,
      };

      // Save trained model
      await this.saveTrainedModel(agentId, this.currentModel!);

      // Generate loss-based insights
      await this.generateLossInsights(agentId, trainingResults);

      logger.info(`RL training completed for agent ${agentId}`);
      return this.currentModel!;

    } catch (error) {
      logger.error('Error training agent:', error);
      throw error;
    }
  }

  private async loadLossAnalysis(agentId: string): Promise<void> {
    try {
      const lossAnalyses = await prisma.lossAnalysis.findMany({
        where: { agentId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      this.lossMemory = lossAnalyses.map(analysis => ({
        tradeId: analysis.tradeId,
        lossAmount: analysis.lossAmount,
        lossReason: analysis.lossReason,
        marketConditions: analysis.marketConditions,
        agentDecision: analysis.agentDecision,
        timestamp: analysis.timestamp,
        severity: analysis.severity,
        category: analysis.category,
      }));

      logger.info(`Loaded ${this.lossMemory.length} loss analyses for agent ${agentId}`);
    } catch (error) {
      logger.error('Error loading loss analysis:', error);
    }
  }

  private async initializeModel(agent: any): Promise<void> {
    try {
      // Check if agent has existing model
      if (agent.modelPath && agent.parameters) {
        // Load existing model
        this.currentModel = {
          id: agent.id,
          algorithm: agent.algorithm || this.config.algorithm,
          version: agent.version || 1,
          parameters: agent.parameters,
          performance: agent.performance || {
            totalReward: 0,
            winRate: 0,
            sharpeRatio: 0,
            drawdown: 0,
          },
          createdAt: agent.createdAt,
          updatedAt: new Date(),
        };

        logger.info(`Loaded existing model for agent ${agent.id}`);
      } else {
        // Initialize new model
        this.currentModel = {
          id: agent.id,
          algorithm: this.config.algorithm,
          version: 1,
          parameters: this.getDefaultParameters(),
          performance: {
            totalReward: 0,
            winRate: 0,
            sharpeRatio: 0,
            drawdown: 0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        logger.info(`Initialized new model for agent ${agent.id}`);
      }
    } catch (error) {
      logger.error('Error initializing model:', error);
      throw error;
    }
  }

  private getDefaultParameters(): any {
    switch (this.config.algorithm) {
      case 'ppo':
        return {
          learningRate: this.config.learningRate,
          batchSize: this.config.batchSize,
          gamma: this.config.gamma,
          clipRange: 0.2,
          entropyCoeff: 0.01,
        };
      case 'a2c':
        return {
          learningRate: this.config.learningRate,
          gamma: this.config.gamma,
          entropyCoeff: 0.01,
        };
      case 'dqn':
        return {
          learningRate: this.config.learningRate,
          gamma: this.config.gamma,
          batchSize: this.config.batchSize,
          targetUpdateInterval: this.config.targetUpdateInterval,
          explorationRate: this.config.explorationRate,
          memorySize: this.config.memorySize,
        };
      case 'sac':
        return {
          learningRate: this.config.learningRate,
          gamma: this.config.gamma,
          batchSize: this.config.batchSize,
          entropyCoeff: 'auto',
        };
      default:
        return {};
    }
  }

  private async createTrainingEnvironment(agent: any, strategyId: string): Promise<any> {
    try {
      // Get historical market data for training
      const marketData = await this.dataPipeline.getDataWithIndicators(
        'EUR/USD',
        '1h',
        1000
      );

      if (marketData.length === 0) {
        throw new Error('No market data available for training');
      }

      return {
        agent,
        strategyId,
        marketData,
        stateSize: this.environment.stateSize,
        actionSize: this.environment.actionSize,
        maxSteps: this.environment.maxSteps,
        lossMemory: this.lossMemory,
        currentBalance: 10000,
      };
    } catch (error) {
      logger.error('Error creating training environment:', error);
      throw error;
    }
  }

  private async runTrainingEpisodes(environment: any, agentId: string): Promise<any> {
    try {
      const episodes = 10; // Number of training episodes
      const results = [];

      for (let episode = 0; episode < episodes; episode++) {
        logger.info(`Starting training episode ${episode + 1}/${episodes}`);

        const episodeResult = await this.runSingleEpisode(environment, agentId);
        results.push(episodeResult);

        // Update model parameters based on episode performance
        await this.updateModelParameters(episodeResult);

        // Log progress
        if ((episode + 1) % 5 === 0) {
          logger.info(`Completed ${episode + 1} episodes. Average reward: ${this.calculateAverageReward(results)}`);
        }
      }

      return {
        episodes: results.length,
        averageReward: this.calculateAverageReward(results),
        bestEpisode: results.reduce((best, current) => 
          current.totalReward > best.totalReward ? current : best
        ),
        learningCurve: results.map(r => r.totalReward),
      };
    } catch (error) {
      logger.error('Error running training episodes:', error);
      throw error;
    }
  }

  private async runSingleEpisode(environment: any, agentId: string): Promise<any> {
    try {
      let currentState = this.getInitialState(environment);
      let totalReward = 0;
      let step = 0;
      const trades = [];
      let done = false;

      while (!done && step < environment.maxSteps) {
        // Get agent action
        const action = await this.selectAction(currentState, environment);

        // Execute action in environment
        const { nextState, reward, done: episodeDone, info } = await this.executeAction(
          action, currentState, environment, step
        );

        // Store experience for learning
        await this.storeExperience(currentState, action, reward, nextState, episodeDone);

        // Learn from experience
        await this.learnFromExperience();

        // Update state
        currentState = nextState;
        totalReward += reward;
        step++;

        // Track trades
        if (info.trade) {
          trades.push(info.trade);
        }

        done = episodeDone;
      }

      return {
        episode: environment.currentEpisode || 0,
        totalReward,
        steps: step,
        trades,
        finalBalance: environment.currentBalance,
        winRate: this.calculateWinRate(trades),
      };
    } catch (error) {
      logger.error('Error running single episode:', error);
      throw error;
    }
  }

  private getInitialState(environment: any): any {
    // Create initial state from market data
    const recentData = environment.marketData.slice(-50);
    
    return {
      prices: recentData.map(d => d.close),
      indicators: {
        atr: recentData.map(d => d.atr).filter(v => v !== undefined),
        rsi: recentData.map(d => d.rsi).filter(v => v !== undefined),
        cci: recentData.map(d => d.cci).filter(v => v !== undefined),
        macd: recentData.map(d => d.macd).filter(v => v !== undefined),
      },
      balance: environment.currentBalance,
      position: null,
      timestamp: recentData[recentData.length - 1]?.timestamp || new Date(),
    };
  }

  private async selectAction(state: any, environment: any): Promise<number> {
    try {
      // Use epsilon-greedy exploration
      const epsilon = this.currentModel!.parameters.explorationRate || 0.1;
      
      if (Math.random() < epsilon) {
        // Explore: random action
        return Math.floor(Math.random() * environment.actionSize);
      } else {
        // Exploit: best action according to model
        return await this.getBestAction(state);
      }
    } catch (error) {
      logger.error('Error selecting action:', error);
      return 0; // Default action
    }
  }

  private async getBestAction(state: any): Promise<number> {
    // This would typically involve neural network inference
    // For now, we'll use a simple heuristic based on loss memory
    
    if (this.lossMemory.length > 0) {
      // Analyze recent losses to avoid similar situations
      const recentLosses = this.lossMemory.slice(-10);
      const lossConditions = recentLosses.map(loss => loss.marketConditions);
      
      // Check if current state resembles loss conditions
      const similarityScore = this.calculateStateSimilarity(state, lossConditions);
      
      if (similarityScore > 0.8) {
        // Avoid actions that led to losses
        return 0; // Hold/neutral action
      }
    }
    
    // Default to simple trend-following
    const prices = state.prices.slice(-10);
    const trend = prices[prices.length - 1] - prices[0];
    
    if (trend > 0) return 1; // Buy
    if (trend < 0) return 2; // Sell
    return 0; // Hold
  }

  private calculateStateSimilarity(currentState: any, lossConditions: any[]): number {
    // Simple similarity calculation based on price patterns
    let totalSimilarity = 0;
    let validComparisons = 0;

    for (const condition of lossConditions) {
      if (condition && condition.prices) {
        const similarity = this.calculatePriceSimilarity(
          currentState.prices.slice(-10),
          condition.prices.slice(-10)
        );
        totalSimilarity += similarity;
        validComparisons++;
      }
    }

    return validComparisons > 0 ? totalSimilarity / validComparisons : 0;
  }

  private calculatePriceSimilarity(prices1: number[], prices2: number[]): number {
    if (prices1.length !== prices2.length) return 0;

    // Normalize prices to percentage changes
    const normalize = (prices: number[]) => {
      const normalized = [];
      for (let i = 1; i < prices.length; i++) {
        normalized.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      return normalized;
    };

    const norm1 = normalize(prices1);
    const norm2 = normalize(prices2);

    // Calculate correlation
    const correlation = this.calculateCorrelation(norm1, norm2);
    return Math.abs(correlation);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;

    const meanX = x.reduce((sum, val) => sum + val, 0) / x.length;
    const meanY = y.reduce((sum, val) => sum + val, 0) / y.length;

    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    for (let i = 0; i < x.length; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denominatorX += diffX * diffX;
      denominatorY += diffY * diffY;
    }

    const denominator = Math.sqrt(denominatorX * denominatorY);
    return denominator > 0 ? numerator / denominator : 0;
  }

  private async executeAction(action: number, state: any, environment: any, step: number): Promise<any> {
    try {
      // Map action to trading decision
      let tradeInfo = null;
      let reward = 0;
      let nextState = { ...state };
      let done = false;

      const currentPrice = state.prices[state.prices.length - 1];

      switch (action) {
        case 1: // Buy
          if (state.position !== 'long') {
            // Execute buy trade
            tradeInfo = {
              action: 'buy',
              price: currentPrice,
              timestamp: new Date(),
              size: this.calculatePositionSize(environment.currentBalance),
            };
            
            // Update position
            nextState.position = 'long';
            nextState.entryPrice = currentPrice;
            
            // Small positive reward for taking action
            reward = 0.1;
          }
          break;

        case 2: // Sell
          if (state.position !== 'short') {
            // Execute sell trade
            tradeInfo = {
              action: 'sell',
              price: currentPrice,
              timestamp: new Date(),
              size: this.calculatePositionSize(environment.currentBalance),
            };
            
            // Update position
            nextState.position = 'short';
            nextState.entryPrice = currentPrice;
            
            // Small positive reward for taking action
            reward = 0.1;
          }
          break;

        case 0: // Hold
        default:
          // Small negative reward for inaction
          reward = -0.01;
          break;
      }

      // Calculate reward based on price movement
      if (state.position) {
        const priceChange = currentPrice - state.entryPrice;
        const pnl = state.position === 'long' ? priceChange : -priceChange;
        
        // Reward based on PnL
        reward += pnl * 100; // Scale reward
        
        // Update balance
        environment.currentBalance += pnl * tradeInfo?.size || 0;
        
        // Check for stop loss or take profit
        if (Math.abs(pnl) > 0.02) { // 2% move
          done = true;
          
          if (pnl < 0) {
            // Loss occurred - add to loss memory
            await this.addToLossMemory({
              tradeId: `trade_${Date.now()}`,
              lossAmount: Math.abs(pnl),
              lossReason: 'stop_loss',
              marketConditions: state,
              agentDecision: { action, confidence: 0.8 },
              timestamp: new Date(),
              severity: Math.abs(pnl) > 0.05 ? 'high' : 'medium',
              category: 'price_movement',
            });
          }
        }
      }

      // Update state with new market data
      if (step < environment.marketData.length - 1) {
        const nextMarketData = environment.marketData[step + 1];
        nextState.prices = [...state.prices.slice(1), nextMarketData.close];
        nextState.indicators = this.updateIndicators(state.indicators, nextMarketData);
        nextState.timestamp = nextMarketData.timestamp;
      }

      return {
        nextState,
        reward,
        done,
        info: { trade: tradeInfo, balance: environment.currentBalance },
      };
    } catch (error) {
      logger.error('Error executing action:', error);
      return {
        nextState: state,
        reward: -1, // Penalty for error
        done: true,
        info: { error: error.message },
      };
    }
  }

  private calculatePositionSize(balance: number): number {
    // Simple position sizing based on balance
    return balance * 0.01; // 1% of balance
  }

  private updateIndicators(currentIndicators: any, newMarketData: any): any {
    // Update indicators with new data
    return {
      ...currentIndicators,
      atr: [...(currentIndicators.atr || []).slice(1), newMarketData.atr].filter(v => v !== undefined),
      rsi: [...(currentIndicators.rsi || []).slice(1), newMarketData.rsi].filter(v => v !== undefined),
      cci: [...(currentIndicators.cci || []).slice(1), newMarketData.cci].filter(v => v !== undefined),
      macd: [...(currentIndicators.macd || []).slice(1), newMarketData.macd].filter(v => v !== undefined),
    };
  }

  private async storeExperience(state: any, action: number, reward: number, nextState: any, done: boolean): Promise<void> {
    // Store experience for replay learning
    // This would typically be stored in a replay buffer
    // For now, we'll just log it
    logger.debug('Storing experience:', { action, reward, done });
  }

  private async learnFromExperience(): Promise<void> {
    // Learning from stored experiences
    // This would typically involve neural network updates
    // For now, we'll implement a simple Q-learning update
    logger.debug('Learning from experience');
  }

  private async updateModelParameters(episodeResult: any): Promise<void> {
    try {
      // Adjust learning parameters based on performance
      const currentParams = this.currentModel!.parameters;
      
      // Adjust exploration rate
      if (episodeResult.winRate > 0.6) {
        currentParams.explorationRate = Math.max(0.01, (currentParams.explorationRate || 0.1) * 0.95);
      } else if (episodeResult.winRate < 0.4) {
        currentParams.explorationRate = Math.min(0.3, (currentParams.explorationRate || 0.1) * 1.05);
      }
      
      // Adjust learning rate based on performance
      if (episodeResult.totalReward > 0) {
        currentParams.learningRate = Math.max(0.0001, currentParams.learningRate * 0.99);
      }
      
      this.currentModel!.updatedAt = new Date();
      
      logger.debug('Updated model parameters:', currentParams);
    } catch (error) {
      logger.error('Error updating model parameters:', error);
    }
  }

  private calculateAverageReward(results: any[]): number {
    return results.reduce((sum, result) => sum + result.totalReward, 0) / results.length;
  }

  private calculateWinRate(trades: any[]): number {
    if (trades.length === 0) return 0;
    
    const winningTrades = trades.filter(trade => trade.pnl > 0);
    return winningTrades.length / trades.length;
  }

  private async evaluateModel(agentId: string, strategyId: string): Promise<any> {
    try {
      // Run backtest to evaluate model performance
      const backtestConfig = this.getBacktestConfig();
      const backtestEngine = new BacktestEngine(backtestConfig);
      
      const results = await backtestEngine.runBacktest(agentId, strategyId);
      
      return {
        totalReward: results.totalPnl,
        winRate: results.winRate,
        sharpeRatio: results.sharpeRatio,
        maxDrawdown: results.maxDrawdown,
        totalTrades: results.totalTrades,
      };
    } catch (error) {
      logger.error('Error evaluating model:', error);
      return {
        totalReward: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        totalTrades: 0,
      };
    }
  }

  private async saveTrainedModel(agentId: string, model: RLModel): Promise<void> {
    try {
      await prisma.agent.update({
        where: { id: agentId },
        data: {
          algorithm: model.algorithm,
          version: model.version,
          parameters: model.parameters,
          performance: model.performance,
          modelPath: `models/agent_${agentId}_v${model.version}.pkl`,
          updatedAt: new Date(),
        },
      });

      logger.info(`Saved trained model for agent ${agentId}`);
    } catch (error) {
      logger.error('Error saving trained model:', error);
    }
  }

  private async addToLossMemory(lossAnalysis: LossAnalysis): Promise<void> {
    try {
      this.lossMemory.push(lossAnalysis);
      
      // Keep only recent losses in memory
      if (this.lossMemory.length > 100) {
        this.lossMemory = this.lossMemory.slice(-100);
      }
      
      // Save to database
      await prisma.lossAnalysis.create({
        data: {
          agentId: lossAnalysis.tradeId.split('_')[1], // Extract agent ID from trade ID
          tradeId: lossAnalysis.tradeId,
          lossAmount: lossAnalysis.lossAmount,
          lossReason: lossAnalysis.lossReason,
          marketConditions: lossAnalysis.marketConditions,
          agentDecision: lossAnalysis.agentDecision,
          timestamp: lossAnalysis.timestamp,
          severity: lossAnalysis.severity,
          category: lossAnalysis.category,
        },
      });
    } catch (error) {
      logger.error('Error adding to loss memory:', error);
    }
  }

  private async generateLossInsights(agentId: string, trainingResults: any): Promise<void> {
    try {
      // Analyze loss patterns and generate insights
      const lossPatterns = this.analyzeLossPatterns();
      
      // Generate learning recommendations
      const recommendations = this.generateLearningRecommendations(lossPatterns);
      
      // Store AI learning data
      await prisma.aILearningData.create({
        data: {
          agentId,
          learningType: 'loss_analysis',
          inputData: {
            lossPatterns,
            trainingResults,
            lossMemorySize: this.lossMemory.length,
          },
          outputData: {
            recommendations,
            insights: lossPatterns.insights,
          },
          timestamp: new Date(),
        },
      });
      
      logger.info(`Generated loss insights for agent ${agentId}`);
    } catch (error) {
      logger.error('Error generating loss insights:', error);
    }
  }

  private analyzeLossPatterns(): any {
    try {
      const patterns = {
        totalLosses: this.lossMemory.length,
        averageLoss: 0,
        mostCommonReason: '',
        lossByCategory: {},
        lossBySeverity: {},
        insights: [],
      };

      if (this.lossMemory.length === 0) {
        return patterns;
      }

      // Calculate average loss
      patterns.averageLoss = this.lossMemory.reduce((sum, loss) => sum + loss.lossAmount, 0) / this.lossMemory.length;

      // Find most common loss reason
      const reasonCounts: Record<string, number> = {};
      this.lossMemory.forEach(loss => {
        reasonCounts[loss.lossReason] = (reasonCounts[loss.lossReason] || 0) + 1;
      });
      patterns.mostCommonReason = Object.keys(reasonCounts).reduce((a, b) => 
        reasonCounts[a] > reasonCounts[b] ? a : b
      );

      // Analyze by category
      this.lossMemory.forEach(loss => {
        patterns.lossByCategory[loss.category] = (patterns.lossByCategory[loss.category] || 0) + 1;
        patterns.lossBySeverity[loss.severity] = (patterns.lossBySeverity[loss.severity] || 0) + 1;
      });

      // Generate insights
      if (patterns.lossBySeverity['high'] > patterns.totalLosses * 0.3) {
        patterns.insights.push('High percentage of severe losses - risk management needs improvement');
      }

      if (patterns.lossByCategory['price_movement'] > patterns.totalLosses * 0.5) {
        patterns.insights.push('Most losses from price movements - consider trend analysis improvements');
      }

      return patterns;
    } catch (error) {
      logger.error('Error analyzing loss patterns:', error);
      return { insights: [] };
    }
  }

  private generateLearningRecommendations(lossPatterns: any): string[] {
    const recommendations: string[] = [];

    if (lossPatterns.averageLoss > 0.05) {
      recommendations.push('Reduce position size to limit average loss amount');
    }

    if (lossPatterns.mostCommonReason === 'stop_loss') {
      recommendations.push('Adjust stop-loss placement based on market volatility');
    }

    if (lossPatterns.lossByCategory['price_movement'] > lossPatterns.totalLosses * 0.6) {
      recommendations.push('Improve trend detection and market timing algorithms');
    }

    if (lossPatterns.lossBySeverity['high'] > lossPatterns.totalLosses * 0.2) {
      recommendations.push('Implement stricter risk management rules');
    }

    return recommendations;
  }

  async continuousLearning(agentId: string, strategyId: string): Promise<void> {
    try {
      logger.info(`Starting continuous learning for agent ${agentId}`);

      // Get recent loss data
      const recentLosses = await prisma.lossAnalysis.findMany({
        where: { agentId },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });

      if (recentLosses.length < 10) {
        logger.info('Insufficient loss data for continuous learning');
        return;
      }

      // Analyze loss patterns
      const lossPatterns = this.analyzeLossPatterns();

      // Check if retraining is needed
      if (this.shouldRetrain(lossPatterns)) {
        logger.info('Retraining agent based on loss patterns');
        await this.trainAgent(agentId, strategyId);
      } else {
        logger.info('No retraining needed at this time');
      }

    } catch (error) {
      logger.error('Error in continuous learning:', error);
    }
  }

  private shouldRetrain(lossPatterns: any): boolean {
    // Determine if retraining is needed based on loss patterns
    return (
      lossPatterns.totalLosses > 20 || // Significant number of losses
      lossPatterns.averageLoss > 0.03 || // High average loss
      lossPatterns.lossBySeverity['high'] > lossPatterns.totalLosses * 0.25 // High severity losses
    );
  }

  async getLearningProgress(agentId: string): Promise<any> {
    try {
      const learningData = await prisma.aILearningData.findMany({
        where: { agentId },
        orderBy: { timestamp: 'desc' },
        take: 20,
      });

      const lossAnalyses = await prisma.lossAnalysis.findMany({
        where: { agentId },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });

      return {
        learningSessions: learningData.length,
        recentLosses: lossAnalyses.length,
        lossTrend: this.calculateLossTrend(lossAnalyses),
        improvementAreas: this.identifyImprovementAreas(lossAnalyses),
        lastTraining: learningData[0]?.timestamp || null,
      };
    } catch (error) {
      logger.error('Error getting learning progress:', error);
      return {};
    }
  }

  private calculateLossTrend(lossAnalyses: any[]): 'improving' | 'stable' | 'deteriorating' {
    if (lossAnalyses.length < 10) return 'stable';

    const recentLosses = lossAnalyses.slice(0, 10);
    const olderLosses = lossAnalyses.slice(10, 20);

    const recentAvg = recentLosses.reduce((sum, loss) => sum + loss.lossAmount, 0) / recentLosses.length;
    const olderAvg = olderLosses.length > 0 ? 
      olderLosses.reduce((sum, loss) => sum + loss.lossAmount, 0) / olderLosses.length : recentAvg;

    if (recentAvg < olderAvg * 0.8) return 'improving';
    if (recentAvg > olderAvg * 1.2) return 'deteriorating';
    return 'stable';
  }

  private identifyImprovementAreas(lossAnalyses: any[]): string[] {
    const areas: string[] = [];
    
    const reasonCounts: Record<string, number> = {};
    lossAnalyses.forEach(loss => {
      reasonCounts[loss.lossReason] = (reasonCounts[loss.lossReason] || 0) + 1;
    });

    const topReasons = Object.entries(reasonCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([reason]) => reason);

    if (topReasons.includes('stop_loss')) {
      areas.push('Stop-loss placement');
    }
    if (topReasons.includes('market_timing')) {
      areas.push('Market timing');
    }
    if (topReasons.includes('position_sizing')) {
      areas.push('Position sizing');
    }

    return areas;
  }
}