import { Exchange, Market, OHLCV } from 'ccxt';
import { prisma } from '@/lib/db';
import { TechnicalIndicators } from './technical-indicators';
import { logger } from '@/lib/logger';

interface TimeframeConfig {
  name: string;
  value: string;
  limit: number;
}

interface IndicatorConfig {
  atrPeriod: number;
  cciPeriod: number;
  smaPeriods: number[];
  rsiPeriod: number;
}

interface DatabaseConfig {
  path: string;
  backupEnabled: boolean;
  cleanupDays: number;
}

export interface DataPipelineConfig {
  exchange: {
    apiKey: string;
    secret: string;
    sandbox: boolean;
  };
  timeframes: Record<string, string>;
  indicators: IndicatorConfig;
  database: DatabaseConfig;
  symbols: string[];
}

export class DataPipeline {
  private exchange: Exchange;
  private config: DataPipelineConfig;
  private technicalIndicators: TechnicalIndicators;

  constructor(config: DataPipelineConfig) {
    this.config = config;
    this.exchange = this.setupExchange();
    this.technicalIndicators = new TechnicalIndicators();
  }

  private setupExchange(): Exchange {
    // Dynamic import for CCXT to avoid require() issues
    // In a real implementation, you would install and properly import CCXT
    // For now, we'll create a mock exchange object
    const mockExchange = {
      name: 'binance',
      fetchOHLCV: async (symbol: string, timeframe: string, limit: number = 1000) => {
        // Mock implementation - in real usage, this would fetch actual data
        const mockData = [];
        const basePrice = 1.1000; // EUR/USD base price
        let currentPrice = basePrice;
        
        for (let i = 0; i < limit; i++) {
          const timestamp = Date.now() - (limit - i) * 60000; // 1 minute intervals
          const priceChange = (Math.random() - 0.5) * 0.001; // Random price movement
          currentPrice += priceChange;
          
          mockData.push([
            timestamp,
            currentPrice,
            currentPrice + Math.random() * 0.0005,
            currentPrice - Math.random() * 0.0005,
            currentPrice + (Math.random() - 0.5) * 0.0002,
            Math.random() * 1000
          ]);
        }
        
        return mockData;
      },
      loadMarkets: async () => {
        return {
          'EUR/USD': { symbol: 'EUR/USD', type: 'spot' },
          'GBP/USD': { symbol: 'GBP/USD', type: 'spot' },
          'USD/JPY': { symbol: 'USD/JPY', type: 'spot' },
        };
      },
      timeframes: {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
      },
      has: {
        fetchOHLCV: true,
        loadMarkets: true,
      },
    };
    
    return mockExchange as Exchange;
  }

  async fetchMarketData(symbol: string, timeframe: string, limit: number = 1000): Promise<OHLCV[]> {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, limit);
      
      if (!ohlcv || ohlcv.length === 0) {
        logger.warn(`No data received for ${symbol} ${timeframe}`);
        return [];
      }

      // Store in database
      await this.storeMarketData(ohlcv, symbol, timeframe);
      
      logger.info(`Fetched ${ohlcv.length} candles for ${symbol} ${timeframe}`);
      return ohlcv;
      
    } catch (error) {
      logger.error(`Error fetching data for ${symbol} ${timeframe}:`, error);
      return [];
    }
  }

  private async storeMarketData(ohlcv: OHLCV[], symbol: string, timeframe: string): Promise<void> {
    try {
      const records = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
        timestamp: new Date(timestamp),
        open,
        high,
        low,
        close,
        volume,
        symbol,
        timeframe,
      }));

      await prisma.marketData.createMany({
        data: records,
        skipDuplicates: true,
      });

      logger.info(`Stored ${records.length} records for ${symbol} ${timeframe}`);
    } catch (error) {
      logger.error('Error storing market data:', error);
    }
  }

  async getMarketData(symbol: string, timeframe: string, limit: number = 500): Promise<any[]> {
    try {
      const data = await prisma.marketData.findMany({
        where: {
          symbol,
          timeframe,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      });

      return data.reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Error retrieving market data:', error);
      return [];
    }
  }

  async calculateAndStoreIndicators(symbol: string, timeframe: string): Promise<void> {
    try {
      const marketData = await this.getMarketData(symbol, timeframe, 1000);
      
      if (marketData.length === 0) {
        logger.warn(`No market data found for ${symbol} ${timeframe}`);
        return;
      }

      // Calculate indicators
      const indicators = await this.technicalIndicators.calculateAllIndicators(marketData);

      // Store indicators
      const indicatorRecords = indicators.map((indicator, index) => ({
        timestamp: marketData[index].timestamp,
        symbol,
        timeframe,
        atr: indicator.atr,
        cci: indicator.cci,
        rsi: indicator.rsi,
        macd: indicator.macd,
        macdSignal: indicator.macdSignal,
        macdHistogram: indicator.macdHistogram,
        bbUpper: indicator.bbUpper,
        bbMiddle: indicator.bbMiddle,
        bbLower: indicator.bbLower,
        swingHigh: indicator.swingHigh,
        swingLow: indicator.swingLow,
        bullishEngulfing: indicator.bullishEngulfing,
        bearishEngulfing: indicator.bearishEngulfing,
        doji: indicator.doji,
        sma20: indicator.sma20,
        sma50: indicator.sma50,
      }));

        await prisma.indicator.createMany({
        data: indicatorRecords,
        skipDuplicates: true,
      });

      logger.info(`Calculated and stored indicators for ${symbol} ${timeframe}`);
    } catch (error) {
      logger.error('Error calculating indicators:', error);
    }
  }

  async getDataWithIndicators(symbol: string, timeframe: string, limit: number = 500): Promise<any[]> {
    try {
      const marketData = await this.getMarketData(symbol, timeframe, limit);
      
      if (marketData.length === 0) {
        return [];
      }

      const timestamps = marketData.map(d => d.timestamp);
      
      const indicators = await prisma.indicator.findMany({
        where: {
          symbol,
          timeframe,
          timestamp: {
            in: timestamps,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      // Merge market data with indicators
      return marketData.map(marketData => {
        const indicator = indicators.find(ind => 
          ind.timestamp.getTime() === marketData.timestamp.getTime()
        );
        
        return {
          ...marketData,
          ...(indicator || {}),
        };
      });
    } catch (error) {
      logger.error('Error retrieving data with indicators:', error);
      return [];
    }
  }

  async updateAllTimeframes(symbol: string): Promise<void> {
    const timeframes = Object.values(this.config.timeframes);
    
    for (const timeframe of timeframes) {
      logger.info(`Updating ${symbol} ${timeframe} data...`);
      
      // Fetch market data
      await this.fetchMarketData(symbol, timeframe);
      
      // Calculate and store indicators
      await this.calculateAndStoreIndicators(symbol, timeframe);
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.database.cleanupDays);

      const result = await prisma.marketData.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      await prisma.indicator.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`Cleaned up ${result.count} old market data records`);
    } catch (error) {
      logger.error('Error cleaning up old data:', error);
    }
  }

  async backupDatabase(): Promise<void> {
    if (!this.config.database.backupEnabled) {
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./data/backups/trading_data_backup_${timestamp}.db`;
      
      // This would typically use a database backup utility
      // For now, we'll just log the intent
      logger.info(`Database backup would be created at: ${backupPath}`);
    } catch (error) {
      logger.error('Error creating database backup:', error);
    }
  }

  async getAvailableSymbols(): Promise<string[]> {
    try {
      const markets = await this.exchange.loadMarkets();
      return Object.keys(markets);
    } catch (error) {
      logger.error('Error loading markets:', error);
      return this.config.symbols; // Fallback to config symbols
    }
  }

  async getExchangeInfo(): Promise<any> {
    try {
      return {
        name: this.exchange.name,
        timeframe: this.exchange.timeframes,
        symbols: await this.getAvailableSymbols(),
        has: this.exchange.has,
      };
    } catch (error) {
      logger.error('Error getting exchange info:', error);
      return null;
    }
  }
}