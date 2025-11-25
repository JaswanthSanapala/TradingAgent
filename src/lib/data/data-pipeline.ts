import { Exchange, OHLCV } from 'ccxt';

import { prisma } from '@/lib/core/db';
import { logger } from '@/lib/core/logger';

import { TechnicalIndicators } from '@/lib/market/technical-indicators';

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

  // --- Yahoo Finance helpers ---
  private isYahooStorageSymbol(symbol: string): boolean {
    return typeof symbol === 'string' && symbol.toUpperCase().startsWith('YF_');
  }

  // Convert storage symbol e.g. 'YF__NSEI' -> '^NSEI', 'YF_RELIANCE_NS' -> 'RELIANCE.NS'
  private storageToYahooTicker(storageSymbol: string): string {
    let s = storageSymbol.trim();
    if (s.toUpperCase().startsWith('YF_')) s = s.slice(3);
    // Leading underscore denotes caret that was sanitized (e.g., ^NSEI)
    if (s.startsWith('_')) s = '^' + s.slice(1);
    // Remaining underscores likely represent dots or dashes; prefer dot for Yahoo local listings
    // This is heuristic; adjust if needed per market
    s = s.replace(/_/g, '.');

    // Normalize common index tickers to include caret even if user passed YF_NSEI (without double underscore)
    const KNOWN_INDEX_TICKERS = new Set(['NSEI', 'NSEBANK', 'BSESN', 'GSPC', 'DJI', 'IXIC']);
    const plain = s.replace(/^\^/, '');
    if (KNOWN_INDEX_TICKERS.has(plain)) {
      s = '^' + plain;
    }
    return s;
  }

  private mapTimeframeToYahooInterval(tf: string): string {
    const t = tf.toLowerCase();
    if (t === '1m') return '1m';
    if (t === '5m') return '5m';
    if (t === '15m') return '15m';
    if (t === '30m') return '30m';
    if (t === '1h') return '60m';
    if (t === '2h') return '60m'; // Yahoo lacks 2h; caller will chunk appropriately
    if (t === '4h') return '60m';
    if (t === '1d') return '1d';
    if (t === '1w' || t === '1wk') return '1wk';
    return '1d';
  }

  // Detect if a Yahoo ticker is an index (which typically doesn't support intraday)
  private isYahooIndexTicker(ticker: string): boolean {
    if (!ticker) return false;
    if (ticker.startsWith('^')) return true;
    const KNOWN_INDEX_TICKERS = new Set(['NSEI', 'NSEBANK', 'BSESN', 'GSPC', 'DJI', 'IXIC']);
    return KNOWN_INDEX_TICKERS.has(ticker.toUpperCase());
  }

  private async fetchYahooRange(params: { ticker: string; interval: string; startMs: number; endMs: number }): Promise<OHLCV[]> {
    const { ticker, interval, startMs, endMs } = params;
    const period1 = Math.floor(startMs / 1000);
    const period2 = Math.floor(endMs / 1000);

    const doFetch = async (t: string, intv: string) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?interval=${encodeURIComponent(intv)}&period1=${period1}&period2=${period2}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      return res;
    };

    const parse = async (res: Response) => {
      const json: any = await res.json();
      const r = json?.chart?.result?.[0];
      if (!r || !Array.isArray(r.timestamp) || !r.indicators?.quote?.[0]) return [];
      const ts: number[] = r.timestamp.map((t: number) => t * 1000);
      const q = r.indicators.quote[0];
      const o: number[] = q.open || [];
      const h: number[] = q.high || [];
      const l: number[] = q.low || [];
      const c: number[] = q.close || [];
      const v: number[] = q.volume || [];
      const out: OHLCV[] = [];
      for (let i = 0; i < ts.length; i++) {
        const open = Number(o[i]);
        const high = Number(h[i]);
        const low = Number(l[i]);
        const close = Number(c[i]);
        const vol = Number(v[i]);
        if ([open, high, low, close].every(Number.isFinite)) {
          out.push([ts[i], open, high, low, close, Number.isFinite(vol) ? vol : 0]);
        }
      }
      return out;
    };

    try {
      // First attempt with provided ticker
      let res = await doFetch(ticker, interval);
      if (res.status === 404) {
        // Retry once toggling caret prefix (handles NSEI vs ^NSEI)
        const alt = ticker.startsWith('^') ? ticker.slice(1) : `^${ticker}`;
        res = await doFetch(alt, interval);
      }
      if (res.status === 422 && interval !== '1d') {
        // Retry with daily interval for symbols where intraday is unsupported
        logger.warn(`Yahoo: 422 error for ${ticker} ${interval}, retrying with 1d interval`);
        const daily = '1d';
        let res2 = await doFetch(ticker, daily);
        if (res2.status === 404) {
          const alt = ticker.startsWith('^') ? ticker.slice(1) : `^${ticker}`;
          res2 = await doFetch(alt, daily);
        }
        if (!res2.ok) {
          logger.error(`Yahoo fetch failed even with 1d fallback: ${res2.status}`);
          return [];
        }
        return await parse(res2);
      }
      if (!res.ok) {
        logger.error(`Yahoo fetch failed for ${ticker} ${interval}: ${res.status}`);
        return [];
      }
      return await parse(res);
    } catch (e) {
      logger.error('Yahoo fetch error', e);
      return [];
    }
  }

  async fetchMarketData(symbol: string, timeframe: string, limit: number = 1000): Promise<OHLCV[]> {
    try {
      if (this.isYahooStorageSymbol(symbol)) {
        const ticker = this.storageToYahooTicker(symbol);
        let interval = this.mapTimeframeToYahooInterval(timeframe);
        let effectiveTimeframe = timeframe;
        // If index ticker, some intraday intervals may be unsupported; fallback to daily preemptively
        if (this.isYahooIndexTicker(ticker) && ['1m','2m','5m','15m','30m','60m','90m'].includes(interval)) {
          logger.warn(`Yahoo index ticker ${ticker} does not support interval ${interval}; using 1d instead`);
          interval = '1d';
          effectiveTimeframe = '1d';
        }
        // Use last N candles by picking an approximate window
        const tfMs = TIMEFRAME_MS[timeframe] ?? 3_600_000;
        const endMs = Date.now();
        const startMs = endMs - tfMs * Math.max(1, limit);
        const ohlcv = await this.fetchYahooRange({ ticker, interval, startMs, endMs });
        if (!ohlcv || ohlcv.length === 0) {
          logger.warn(`No data received (Yahoo) for ${symbol} ${timeframe}`);
          return [];
        }
        await this.storeMarketData(ohlcv, symbol, effectiveTimeframe);
        logger.info(`Fetched ${ohlcv.length} candles (Yahoo) for ${symbol} ${effectiveTimeframe}`);
        return ohlcv;
      }

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
    const isYahoo = this.isYahooStorageSymbol(symbol);
    if (!isYahoo) {
      await this.ensureExchange();
    }

    const tfMs = TIMEFRAME_MS[timeframe];
    if (!tfMs) throw new Error(`Unsupported timeframe ${timeframe}`);

    let since = startMs;
    let inserted = 0;

    while (since < endMs) {
      try {
        let ohlcv: OHLCV[] = [];
        if (isYahoo) {
          const ticker = this.storageToYahooTicker(symbol);
          let interval = this.mapTimeframeToYahooInterval(timeframe);
          // Track actual timeframe being used for chunking (may differ for Yahoo index)
          let effectiveTfMs = tfMs;
          let effectiveTimeframe = timeframe;

          // Yahoo index tickers don't support intraday intervals
          if (this.isYahooIndexTicker(ticker) && ['1m','2m','5m','15m','30m','60m','90m'].includes(interval)) {
            logger.warn(`Yahoo index ticker ${ticker} does not support interval ${interval}; using 1d instead`);
            interval = '1d';
            effectiveTfMs = TIMEFRAME_MS['1d'];
            effectiveTimeframe = '1d';
          }

          const next = Math.min(since + effectiveTfMs * limitPerCall, endMs);
          ohlcv = await this.fetchYahooRange({ ticker, interval, startMs: since, endMs: next });
        } else {
          ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, since, limitPerCall);
        }
        if (!ohlcv || ohlcv.length === 0) {
          // advance one step to avoid infinite loop
          // If Yahoo, use the effective timeframe used for chunking; otherwise original tfMs
          const stepMs = isYahoo ? (this.isYahooIndexTicker(this.storageToYahooTicker(symbol)) ? TIMEFRAME_MS['1d'] : tfMs) : tfMs;
          since += stepMs * limitPerCall;
        } else {
          // If Yahoo with effective 1d fallback, store under 1d timeframe to avoid misleading entries
          const ticker = isYahoo ? this.storageToYahooTicker(symbol) : '';
          const storeTf = (isYahoo && this.isYahooIndexTicker(ticker) && ['1m','2m','5m','15m','30m','60m','90m'].includes(this.mapTimeframeToYahooInterval(timeframe))) ? '1d' : timeframe;
          await this.storeMarketData(ohlcv, symbol, storeTf);
          inserted += ohlcv.length;

          const lastTs = ohlcv[ohlcv.length - 1][0] as number;
          // advance to the next candle after lastTs
          since = Math.max(lastTs + tfMs, since + tfMs);
        }
        if (sleepMs > 0) await new Promise(r => setTimeout(r, sleepMs));
      } catch (e: any) {
        const msg = e?.message || String(e);
        logger.warn(`Error fetching ${symbol} ${timeframe} since=${new Date(since).toISOString()}: ${msg}`);
        // Exponential backoff on rate limits, but also advance cursor to avoid infinite loops
        await new Promise(r => setTimeout(r, Math.min(5000, sleepMs * 4)));
        const stepMs = isYahoo ? (this.isYahooIndexTicker(this.storageToYahooTicker(symbol)) ? TIMEFRAME_MS['1d'] : tfMs) : tfMs;
        since += stepMs * limitPerCall; // Advance to prevent infinite retry on same chunk
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