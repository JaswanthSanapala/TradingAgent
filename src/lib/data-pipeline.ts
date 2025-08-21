import { Exchange, OHLCV } from 'ccxt';
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
    apiKey?: string;
    secret?: string;
    sandbox?: boolean;
    id?: string; // e.g. 'binance', 'coinbase'
  };
  timeframes: Record<string, string>;
  indicators: IndicatorConfig;
  database: DatabaseConfig;
  symbols: string[];
}

const TIMEFRAME_MS: Record<string, number> = {
  '1m': 60_000,
  '3m': 180_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '2h': 7_200_000,
  '4h': 14_400_000,
  '6h': 21_600_000,
  '8h': 28_800_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '1w': 604_800_000,
};

export class DataPipeline {
  private exchange!: Exchange;
  private config: DataPipelineConfig;
  private technicalIndicators: TechnicalIndicators;

  constructor(config: DataPipelineConfig) {
    this.config = config;
    this.technicalIndicators = new TechnicalIndicators();
  }

  private async setupExchange(): Promise<Exchange> {
    // Dynamically import ccxt to avoid SSR bundling issues
    const ccxt = await import('ccxt');
    const exId = (this.config.exchange.id || 'binance') as keyof typeof ccxt;
    const ExClass = (ccxt as any)[exId];
    if (!ExClass) {
      throw new Error(`Exchange '${this.config.exchange.id}' not found in ccxt`);
    }

    const instance: Exchange = new ExClass({
      apiKey: this.config.exchange.apiKey,
      secret: this.config.exchange.secret,
      enableRateLimit: true,
      options: {
        adjustForTimeDifference: true,
      },
    });

    if ((this.config.exchange?.sandbox ?? false) && (instance as any).setSandboxMode) {
      (instance as any).setSandboxMode(true);
    }

    await instance.loadMarkets();
    logger.info(`Connected to exchange: ${instance.name}`);
    return instance;
  }

  private async ensureExchange() {
    if (!this.exchange) {
      this.exchange = await this.setupExchange();
    }
  }

  async fetchMarketData(symbol: string, timeframe: string, limit: number = 1000): Promise<OHLCV[]> {
    try {
      await this.ensureExchange();
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

      if (!ohlcv || ohlcv.length === 0) {
        logger.warn(`No data received for ${symbol} ${timeframe}`);
        return [];
      }

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
        timestamp: new Date(timestamp as number),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
        symbol,
        timeframe,
      }));

      // Basic QC and sanity checks
      const sane = records.filter(r =>
        Number.isFinite(r.open) && Number.isFinite(r.high) && Number.isFinite(r.low) && Number.isFinite(r.close) &&
        r.high >= Math.max(r.open, r.close) && r.low <= Math.min(r.open, r.close) &&
        r.volume >= 0
      );

      if (sane.length === 0) return;

      // Dedupe against existing rows by (timestamp, symbol, timeframe)
      const timestamps = sane.map(r => r.timestamp);
      const existing = await prisma.marketData.findMany({
        where: { symbol, timeframe, timestamp: { in: timestamps } },
        select: { timestamp: true },
      });
      const existSet = new Set(existing.map(e => e.timestamp.getTime()));
      const toInsert = sane.filter(r => !existSet.has(r.timestamp.getTime()));

      if (toInsert.length > 0) {
        await prisma.marketData.createMany({ data: toInsert });
      }
      logger.info(`Stored ${toInsert.length} new records for ${symbol} ${timeframe}`);
    } catch (error) {
      logger.error('Error storing market data:', error);
    }
  }

  async getMarketData(symbol: string, timeframe: string, limit: number = 500): Promise<any[]> {
    try {
      const data = await prisma.marketData.findMany({
        where: { symbol, timeframe },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return data.reverse();
    } catch (error) {
      logger.error('Error retrieving market data:', error);
      return [];
    }
  }

  async calculateAndStoreIndicators(symbol: string, timeframe: string): Promise<void> {
    try {
      const marketData = await prisma.marketData.findMany({
        where: { symbol, timeframe },
        orderBy: { timestamp: 'asc' },
      });

      if (marketData.length === 0) {
        logger.warn(`No market data found for ${symbol} ${timeframe}`);
        return;
      }

      const indicators = await this.technicalIndicators.calculateAllIndicators(marketData);

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

      // Dedupe indicators by (timestamp, symbol, timeframe)
      const indTimestamps = indicatorRecords.map(r => r.timestamp);
      const existingInd = await prisma.indicator.findMany({
        where: { symbol, timeframe, timestamp: { in: indTimestamps } },
        select: { timestamp: true },
      });
      const indSet = new Set(existingInd.map(e => e.timestamp.getTime()));
      const indToInsert = indicatorRecords.filter(r => !indSet.has(r.timestamp.getTime()));

      if (indToInsert.length > 0) {
        await prisma.indicator.createMany({ data: indToInsert });
      }
      logger.info(`Calculated and stored ${indToInsert.length} indicator rows for ${symbol} ${timeframe}`);
    } catch (error) {
      logger.error('Error calculating indicators:', error);
    }
  }

  async getDataWithIndicators(symbol: string, timeframe: string, limit: number = 500): Promise<any[]> {
    try {
      const marketData = await this.getMarketData(symbol, timeframe, limit);
      if (marketData.length === 0) return [];

      const timestamps = marketData.map(d => d.timestamp);
      const indicators = await prisma.indicator.findMany({
        where: { symbol, timeframe, timestamp: { in: timestamps } },
        orderBy: { timestamp: 'asc' },
      });

      return marketData.map(marketData => {
        const indicator = indicators.find(ind => ind.timestamp.getTime() === marketData.timestamp.getTime());
        return { ...marketData, ...(indicator || {}) };
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
      await this.fetchMarketData(symbol, timeframe);
      await this.calculateAndStoreIndicators(symbol, timeframe);
    }
  }

  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.database.cleanupDays);

      const result = await prisma.marketData.deleteMany({ where: { timestamp: { lt: cutoffDate } } });
      await prisma.indicator.deleteMany({ where: { timestamp: { lt: cutoffDate } } });

      logger.info(`Cleaned up ${result.count} old market data records`);
    } catch (error) {
      logger.error('Error cleaning up old data:', error);
    }
  }

  async backupDatabase(): Promise<void> {
    if (!this.config.database.backupEnabled) return;
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./data/backups/trading_data_backup_${timestamp}.db`;
      logger.info(`Database backup would be created at: ${backupPath}`);
    } catch (error) {
      logger.error('Error creating database backup:', error);
    }
  }

  async getAvailableSymbols(): Promise<string[]> {
    try {
      await this.ensureExchange();
      const markets = await this.exchange.loadMarkets();
      return Object.keys(markets);
    } catch (error) {
      logger.error('Error loading markets:', error);
      return this.config.symbols;
    }
  }

  async getExchangeInfo(): Promise<any> {
    try {
      await this.ensureExchange();
      return {
        name: this.exchange.name,
        timeframe: (this.exchange as any).timeframes,
        symbols: await this.getAvailableSymbols(),
        has: (this.exchange as any).has,
      };
    } catch (error) {
      logger.error('Error getting exchange info:', error);
      return null;
    }
  }

  // New: robust chunked fetch between start/end timestamps
  async fetchOHLCVChunked(params: {
    symbol: string;
    timeframe: string; // e.g. '1m','5m','1h','1d'
    startMs: number; // inclusive
    endMs: number;   // exclusive
    limitPerCall?: number; // default 1000 (binance)
    sleepMs?: number; // backoff between calls
  }): Promise<number> {
    const { symbol, timeframe, startMs, endMs, limitPerCall = 1000, sleepMs = 250 } = params;
    await this.ensureExchange();

    const tfMs = TIMEFRAME_MS[timeframe];
    if (!tfMs) throw new Error(`Unsupported timeframe ${timeframe}`);

    let since = startMs;
    let inserted = 0;

    while (since < endMs) {
      try {
        const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, since, limitPerCall);
        if (!ohlcv || ohlcv.length === 0) {
          // advance one step to avoid infinite loop
          since += tfMs * limitPerCall;
        } else {
          await this.storeMarketData(ohlcv, symbol, timeframe);
          inserted += ohlcv.length;

          const lastTs = ohlcv[ohlcv.length - 1][0] as number;
          // advance to the next candle after lastTs
          since = Math.max(lastTs + tfMs, since + tfMs);
        }
        if (sleepMs > 0) await new Promise(r => setTimeout(r, sleepMs));
      } catch (e: any) {
        const msg = e?.message || String(e);
        // logger.warn(`Rate/error on fetch: ${symbol} ${timeframe} since=${since}: ${msg}`);
        // Exponential backoff on rate limits
        await new Promise(r => setTimeout(r, Math.min(5000, sleepMs * 4)));
      }
      // Protect from runaway loops
      if ((endMs - since) / tfMs < 1) break;
    }

    logger.info(`Backfill complete for ${symbol} ${timeframe}, inserted ~${inserted} rows`);
    return inserted;
  }

  // New: Backfill a date range using chunked fetch
  async backfillRange(symbol: string, timeframe: string, startDate: Date, endDate: Date): Promise<{ inserted: number }>{
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    if (endMs <= startMs) return { inserted: 0 };

    const inserted = await this.fetchOHLCVChunked({ symbol, timeframe, startMs, endMs });

    // Compute indicators after backfill
    await this.calculateAndStoreIndicators(symbol, timeframe);
    return { inserted };
  }
}