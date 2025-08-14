import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  symbol: string;
  initialBalance: number;
  maxRiskPerTrade: number;
  maxTradesPerDay: number;
  minRewardRiskRatio: number;
}

export interface Trade {
  id: string;
  entryTime: Date;
  exitTime?: Date;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  action: 'buy' | 'sell';
  pnl?: number;
  pnlPercent?: number;
  status: 'open' | 'closed' | 'stopped_out' | 'take_profit';
  agentId: string;
  strategyId: string;
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgTradeDuration: number; // in hours
  trades: Trade[];
  equityCurve: Array<{ timestamp: Date; balance: number }>;
  monthlyPerformance: Record<string, any>;
  riskMetrics: Record<string, any>;
  tradeDistribution: Record<string, any>;
  enhancedMetrics: Record<string, any>;
}

export class BacktestEngine {
  private config: BacktestConfig;
  private trades: Trade[] = [];
  private equityCurve: Array<{ timestamp: Date; balance: number }> = [];
  private currentBalance: number;
  private peakBalance: number;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.currentBalance = config.initialBalance;
    this.peakBalance = config.initialBalance;
  }

  async runBacktest(agentId: string, strategyId: string): Promise<BacktestResult> {
    try {
      logger.info(`Starting backtest for agent ${agentId}, strategy ${strategyId}`);

      // Reset state
      this.trades = [];
      this.equityCurve = [];
      this.currentBalance = this.config.initialBalance;
      this.peakBalance = this.config.initialBalance;

      // Get agent and strategy
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: { strategy: true }
      });

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Get market data for the period
      const marketData = await this.getMarketData();
      
      if (marketData.length === 0) {
        throw new Error('No market data found for the specified period');
      }

      // Run simulation
      await this.simulateTrading(marketData, agent, strategyId);

      // Calculate results
      const result = this.calculateResults();

      // Enhance results with additional analysis
      const enhancedResult = await this.enhanceBacktestResults(result);

      // Save results to database
      await this.saveBacktestResults(agentId, strategyId, enhancedResult);

      logger.info(`Backtest completed. Total trades: ${enhancedResult.totalTrades}`);
      return enhancedResult;

    } catch (error) {
      logger.error('Error running backtest:', error);
      throw error;
    }
  }

  private async getMarketData(): Promise<any[]> {
    try {
      return await prisma.marketData.findMany({
        where: {
          symbol: this.config.symbol,
          timestamp: {
            gte: this.config.startDate,
            lte: this.config.endDate,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });
    } catch (error) {
      logger.error('Error retrieving market data:', error);
      return [];
    }
  }

  private async simulateTrading(marketData: any[], agent: any, strategyId: string): Promise<void> {
    // Get agent's trading logic or model
    const agentModel = await this.loadAgentModel(agent);
    
    // Track daily trades
    const dailyTrades = new Map<string, number>();

    for (let i = 0; i < marketData.length; i++) {
      const currentCandle = marketData[i];
      const currentTime = currentCandle.timestamp;
      const dateKey = currentTime.toISOString().split('T')[0];

      // Check daily trade limit
      const todayTrades = dailyTrades.get(dateKey) || 0;
      if (todayTrades >= this.config.maxTradesPerDay) {
        continue;
      }

      // Get agent's decision
      const decision = await this.getAgentDecision(agentModel, marketData.slice(0, i + 1));

      if (decision && decision.action) {
        // Execute trade
        const trade = await this.executeTrade(decision, currentTime, currentCandle.close, agent.id, strategyId);
        
        if (trade) {
          this.trades.push(trade);
          dailyTrades.set(dateKey, todayTrades + 1);
        }
      }

      // Check existing trades for exit conditions
      await this.checkExitConditions(currentCandle, currentTime);

      // Update equity curve
      this.updateEquityCurve(currentTime);
    }
  }

  private async loadAgentModel(agent: any): Promise<any> {
    try {
      // Load the agent's trained model
      // This would typically involve loading a neural network model
      // For now, we'll return the agent configuration
      return {
        id: agent.id,
        modelPath: agent.modelPath,
        parameters: agent.parameters,
        strategy: agent.strategy,
      };
    } catch (error) {
      logger.error('Error loading agent model:', error);
      return null;
    }
  }

  private async getAgentDecision(agentModel: any, marketData: any[]): Promise<any> {
    try {
      // This is where the agent makes trading decisions
      // In a real implementation, this would use the loaded model
      // to predict actions based on market data

      // For demonstration, we'll use a simple logic
      if (marketData.length < 20) return null;

      const recentData = marketData.slice(-20);
      const closes = recentData.map(d => d.close);
      
      // Simple moving average crossover strategy
      const sma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const sma20 = closes.reduce((a, b) => a + b, 0) / 20;

      if (sma5 > sma20) {
        return {
          action: 'buy',
          confidence: 0.7,
        };
      } else if (sma5 < sma20) {
        return {
          action: 'sell',
          confidence: 0.7,
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting agent decision:', error);
      return null;
    }
  }

  private async executeTrade(decision: any, entryTime: Date, currentPrice: number, agentId: string, strategyId: string): Promise<Trade | null> {
    try {
      // Check if we already have open trades
      const openTrades = this.trades.filter(t => t.status === 'open');
      if (openTrades.length >= 1) {
        return null;
      }

      // Calculate risk management parameters
      const riskAmount = this.currentBalance * this.config.maxRiskPerTrade;
      const atr = await this.getCurrentATR(); // Get current ATR for stop loss calculation
      
      if (!atr) return null;

      // Calculate position size and stop loss/take profit
      const stopLossDistance = atr * 1.5; // 1.5x ATR for stop loss
      const takeProfitDistance = stopLossDistance * this.config.minRewardRiskRatio;

      let stopLoss: number, takeProfit: number;

      if (decision.action === 'buy') {
        stopLoss = currentPrice - stopLossDistance;
        takeProfit = currentPrice + takeProfitDistance;
      } else {
        stopLoss = currentPrice + stopLossDistance;
        takeProfit = currentPrice - takeProfitDistance;
      }

      const positionSize = riskAmount / stopLossDistance;

      const trade: Trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        entryTime,
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        positionSize,
        action: decision.action,
        status: 'open',
        agentId,
        strategyId,
      };

      logger.info(`Executed ${decision.action} trade at ${currentPrice}`);
      return trade;

    } catch (error) {
      logger.error('Error executing trade:', error);
      return null;
    }
  }

  private async getCurrentATR(): Promise<number | null> {
    try {
      // Get recent market data to calculate ATR
      const recentData = await prisma.marketData.findMany({
        where: {
          symbol: this.config.symbol,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 15,
      });

      if (recentData.length < 14) return null;

      const highs = recentData.map(d => d.high);
      const lows = recentData.map(d => d.low);
      const closes = recentData.map(d => d.close);

      // Calculate ATR (simplified version)
      let atr = 0;
      for (let i = 1; i < recentData.length; i++) {
        const tr = Math.max(
          highs[i] - lows[i],
          Math.abs(highs[i] - closes[i - 1]),
          Math.abs(lows[i] - closes[i - 1])
        );
        atr += tr;
      }
      atr /= (recentData.length - 1);

      return atr;
    } catch (error) {
      logger.error('Error calculating ATR:', error);
      return null;
    }
  }

  private async checkExitConditions(currentCandle: any, currentTime: Date): Promise<void> {
    const openTrades = this.trades.filter(t => t.status === 'open');

    for (const trade of openTrades) {
      const currentPrice = currentCandle.close;

      // Check stop loss
      if (trade.action === 'buy') {
        if (currentPrice <= trade.stopLoss) {
          await this.closeTrade(trade, currentTime, trade.stopLoss, 'stopped_out');
        } else if (currentPrice >= trade.takeProfit) {
          await this.closeTrade(trade, currentTime, trade.takeProfit, 'take_profit');
        }
      } else { // sell
        if (currentPrice >= trade.stopLoss) {
          await this.closeTrade(trade, currentTime, trade.stopLoss, 'stopped_out');
        } else if (currentPrice <= trade.takeProfit) {
          await this.closeTrade(trade, currentTime, trade.takeProfit, 'take_profit');
        }
      }
    }
  }

  private async closeTrade(trade: Trade, exitTime: Date, exitPrice: number, status: string): Promise<void> {
    trade.exitTime = exitTime;
    trade.exitPrice = exitPrice;
    trade.status = status;

    // Calculate PnL
    if (trade.action === 'buy') {
      trade.pnl = (exitPrice - trade.entryPrice) * trade.positionSize;
    } else { // sell
      trade.pnl = (trade.entryPrice - exitPrice) * trade.positionSize;
    }

    trade.pnlPercent = trade.pnl / (trade.entryPrice * trade.positionSize) * 100;

    // Update balance
    this.currentBalance += trade.pnl;
    this.peakBalance = Math.max(this.peakBalance, this.currentBalance);

    logger.info(`Closed ${trade.action} trade: PnL = ${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
  }

  private updateEquityCurve(timestamp: Date): void {
    this.equityCurve.push({
      timestamp,
      balance: this.currentBalance,
    });
  }

  private calculateResults(): BacktestResult {
    if (this.trades.length === 0) {
      return this.createEmptyResult();
    }

    const closedTrades = this.trades.filter(t => t.status !== 'open');
    const winningTrades = closedTrades.filter(t => t.pnl && t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl && t.pnl < 0);

    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;
    const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalPnlPercent = (this.currentBalance - this.config.initialBalance) / this.config.initialBalance * 100;

    // Calculate drawdown
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let peak = this.config.initialBalance;

    for (const point of this.equityCurve) {
      if (point.balance > peak) {
        peak = point.balance;
      }
      const drawdown = peak - point.balance;
      const drawdownPercent = drawdown / peak * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    // Calculate Sharpe ratio (simplified)
    const returns = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prevBalance = this.equityCurve[i - 1].balance;
      const currBalance = this.equityCurve[i].balance;
      const ret = (currBalance - prevBalance) / prevBalance;
      returns.push(ret);
    }

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = stdReturn > 0 ? avgReturn / stdReturn : 0;

    // Calculate profit factor
    const totalWins = winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : Infinity;

    // Calculate average win/loss
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0) / losingTrades.length : 0;

    // Calculate average trade duration
    const durations = closedTrades
      .filter(trade => trade.exitTime)
      .map(trade => (trade.exitTime!.getTime() - trade.entryTime.getTime()) / (1000 * 60 * 60)); // hours
    const avgTradeDuration = durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    return {
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      totalPnl,
      totalPnlPercent,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      profitFactor,
      avgWin,
      avgLoss,
      avgTradeDuration,
      trades: this.trades,
      equityCurve: this.equityCurve,
      monthlyPerformance: {},
      riskMetrics: {},
      tradeDistribution: {},
      enhancedMetrics: {},
    };
  }

  private createEmptyResult(): BacktestResult {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgTradeDuration: 0,
      trades: [],
      equityCurve: [],
      monthlyPerformance: {},
      riskMetrics: {},
      tradeDistribution: {},
      enhancedMetrics: {},
    };
  }

  private async enhanceBacktestResults(result: BacktestResult): Promise<BacktestResult> {
    try {
      // Calculate monthly performance
      result.monthlyPerformance = this.calculateMonthlyPerformance();

      // Calculate risk metrics
      result.riskMetrics = this.calculateRiskMetrics();

      // Analyze trade distribution
      result.tradeDistribution = this.analyzeTradeDistribution();

      // Calculate enhanced metrics
      result.enhancedMetrics = this.calculateEnhancedMetrics(result);

      return result;
    } catch (error) {
      logger.error('Error enhancing backtest results:', error);
      return result;
    }
  }

  private calculateMonthlyPerformance(): Record<string, any> {
    const monthlyData: Record<string, any> = {};

    const closedTrades = this.trades.filter(t => t.status !== 'open' && t.exitTime);

    for (const trade of closedTrades) {
      const monthKey = trade.exitTime!.toISOString().substring(0, 7); // YYYY-MM

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          trades: 0,
          pnl: 0,
          wins: 0,
          losses: 0,
        };
      }

      monthlyData[monthKey].trades++;
      monthlyData[monthKey].pnl += trade.pnl || 0;

      if ((trade.pnl || 0) > 0) {
        monthlyData[monthKey].wins++;
      } else {
        monthlyData[monthKey].losses++;
      }
    }

    // Calculate win rates
    for (const monthData of Object.values(monthlyData)) {
      monthData.winRate = monthData.trades > 0 ? monthData.wins / monthData.trades : 0;
    }

    return monthlyData;
  }

  private calculateRiskMetrics(): Record<string, any> {
    const closedTrades = this.trades.filter(t => t.status !== 'open' && t.pnl !== undefined);
    const pnls = closedTrades.map(t => t.pnl!);

    if (pnls.length === 0) return {};

    const sortedPnls = [...pnls].sort((a, b) => a - b);
    const var95 = sortedPnls[Math.floor(sortedPnls.length * 0.05)];
    const losses = pnls.filter(p => p < 0);
    const expectedShortfall = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;

    return {
      valueAtRisk95: var95,
      expectedShortfall,
      volatility: Math.sqrt(pnls.reduce((sum, p) => sum + Math.pow(p - pnls.reduce((a, b) => a + b, 0) / pnls.length, 2), 0) / pnls.length),
    };
  }

  private analyzeTradeDistribution(): Record<string, any> {
    const dayAnalysis: Record<string, any> = {};
    const hourAnalysis: Record<string, any> = {};

    for (const trade of this.trades) {
      if (trade.entryTime) {
        const dayName = trade.entryTime.toLocaleDateString('en-US', { weekday: 'long' });
        const hour = trade.entryTime.getHours();

        // Day analysis
        if (!dayAnalysis[dayName]) {
          dayAnalysis[dayName] = { trades: 0, pnl: 0 };
        }
        dayAnalysis[dayName].trades++;
        dayAnalysis[dayName].pnl += trade.pnl || 0;

        // Hour analysis
        if (!hourAnalysis[hour]) {
          hourAnalysis[hour] = { trades: 0, pnl: 0 };
        }
        hourAnalysis[hour].trades++;
        hourAnalysis[hour].pnl += trade.pnl || 0;
      }
    }

    return {
      byDayOfWeek: dayAnalysis,
      byHour: hourAnalysis,
    };
  }

  private calculateEnhancedMetrics(result: BacktestResult): Record<string, any> {
    const enhanced: Record<string, any> = {};

    // Consecutive wins/losses
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentStreak = 0;
    let currentStreakType: 'win' | 'loss' | null = null;

    for (const trade of this.trades) {
      if (trade.pnl !== undefined && trade.status !== 'open') {
        if (trade.pnl > 0) {
          if (currentStreakType === 'win') {
            currentStreak++;
          } else {
            currentStreak = 1;
            currentStreakType = 'win';
          }
          maxConsecutiveWins = Math.max(maxConsecutiveWins, currentStreak);
        } else {
          if (currentStreakType === 'loss') {
            currentStreak++;
          } else {
            currentStreak = 1;
            currentStreakType = 'loss';
          }
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
        }
      }
    }

    enhanced.maxConsecutiveWins = maxConsecutiveWins;
    enhanced.maxConsecutiveLosses = maxConsecutiveLosses;

    // Recovery factor
    enhanced.recoveryFactor = result.maxDrawdown > 0 ? Math.abs(result.totalPnl / result.maxDrawdown) : 
      (result.totalPnl > 0 ? Infinity : 0);

    return enhanced;
  }

  private async saveBacktestResults(agentId: string, strategyId: string, results: BacktestResult): Promise<number> {
    try {
      const backtest = await prisma.backtest.create({
        data: {
          agentId,
          strategyId,
          startDate: this.config.startDate,
          endDate: this.config.endDate,
          symbol: this.config.symbol,
          initialBalance: this.config.initialBalance,
          finalBalance: this.currentBalance,
          totalTrades: results.totalTrades,
          winningTrades: results.winningTrades,
          losingTrades: results.losingTrades,
          winRate: results.winRate,
          totalPnl: results.totalPnl,
          maxDrawdown: results.maxDrawdown,
          sharpeRatio: results.sharpeRatio,
          profitFactor: results.profitFactor,
          avgWin: results.avgWin,
          avgLoss: results.avgLoss,
          monthlyPerformance: results.monthlyPerformance,
          riskMetrics: results.riskMetrics,
          tradeDistribution: results.tradeDistribution,
          enhancedMetrics: results.enhancedMetrics,
          status: 'completed',
        },
      });

      // Save individual trades
      for (const trade of results.trades) {
        await prisma.trade.create({
          data: {
            backtestId: backtest.id,
            agentId,
            strategyId,
            entryTime: trade.entryTime,
            exitTime: trade.exitTime,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice,
            stopLoss: trade.stopLoss,
            takeProfit: trade.takeProfit,
            positionSize: trade.positionSize,
            action: trade.action,
            pnl: trade.pnl,
            pnlPercent: trade.pnlPercent,
            status: trade.status,
          },
        });
      }

      logger.info(`Backtest results saved with ID: ${backtest.id}`);
      return backtest.id;

    } catch (error) {
      logger.error('Error saving backtest results:', error);
      throw error;
    }
  }

  async getBacktestResults(limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      return await prisma.backtest.findMany({
        include: {
          agent: {
            include: {
              strategy: true,
            },
          },
          trades: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      logger.error('Error retrieving backtest results:', error);
      return [];
    }
  }

  async compareBacktests(backtestIds: number[]): Promise<any> {
    try {
      const backtests = await prisma.backtest.findMany({
        where: {
          id: {
            in: backtestIds,
          },
        },
        include: {
          agent: true,
        },
      });

      const comparison = this.generateComparisonAnalysis(backtests);

      return {
        success: true,
        comparison,
        backtests,
      };
    } catch (error) {
      logger.error('Error comparing backtests:', error);
      return { success: false, error: error.message };
    }
  }

  private generateComparisonAnalysis(backtests: any[]): any {
    const analysis = {
      bestPerformer: null,
      metricsComparison: {},
      recommendations: [],
    };

    // Find best performer by Sharpe ratio
    let bestSharpe = -Infinity;
    let bestBacktest = null;

    for (const backtest of backtests) {
      if (backtest.sharpeRatio > bestSharpe) {
        bestSharpe = backtest.sharpeRatio;
        bestBacktest = backtest;
      }
    }

    if (bestBacktest) {
      analysis.bestPerformer = {
        id: bestBacktest.id,
        agentName: bestBacktest.agent.name,
        sharpeRatio: bestBacktest.sharpeRatio,
        totalPnl: bestBacktest.totalPnl,
        winRate: bestBacktest.winRate,
      };
    }

    // Compare key metrics
    const metrics = ['totalPnl', 'winRate', 'sharpeRatio', 'maxDrawdown', 'profitFactor'];

    for (const metric of metrics) {
      const values = backtests.map(b => b[metric]).filter(v => v !== null && v !== undefined);
      if (values.length > 0) {
        analysis.metricsComparison[metric] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          bestBacktest: backtests.find(b => b[metric] === Math.max(...values))?.agent?.name || 'Unknown',
        };
      }
    }

    // Generate recommendations
    if (analysis.bestPerformer) {
      analysis.recommendations.push(
        `Consider using agent '${analysis.bestPerformer.agentName}' which achieved the highest Sharpe ratio of ${analysis.bestPerformer.sharpeRatio.toFixed(3)}`
      );
    }

    return analysis;
  }
}