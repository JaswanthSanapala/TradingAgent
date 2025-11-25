import { fetchOHLCV,getTickerPrice } from '@/lib/trading/broker';
import { CONFIG } from '@/lib/core/config';
import { prisma } from '@/lib/core/db';
import { createLogger } from '@/lib/core/logger';
import { predictForAgent } from '@/lib/ml/predictor';
import { socketBus } from '@/lib/sockets/socket-bus';

const log = createLogger('MarketStreamer');

let started = false;
let timer: NodeJS.Timeout | null = null;
const lastTs: Record<string, number> = {}; // key: `${symbol}|${tf}` stores ms timestamp of last candle predicted

function toDbSymbol(ccxtSymbol: string): string {
  // 'BTC/USDT' -> 'BTC_USDT'
  return ccxtSymbol.replace('/', '_');
}

export function startMarketStreamer() {
  if (started) return;
  started = true;
  const symbols = CONFIG.SYMBOLS;
  if (!symbols || symbols.length === 0) {
    log.warn('No symbols configured for market streamer');
    return;
  }
  const tick = async () => {
    for (const symbol of symbols) {
      try {
        const price = await getTickerPrice(symbol);
        const payload = { symbol, price, ts: new Date().toISOString() };
        socketBus.emit('market:tick', payload);
      } catch (e: any) {
        log.error('Failed to fetch ticker', { symbol, error: e?.message });
      }
      // For each configured timeframe, emit the latest OHLCV candle as well
      try {
        const tfs = Object.keys(CONFIG.TIMEFRAMES || {});
        for (const tf of tfs) {
          try {
            const candles = await fetchOHLCV(symbol, tf, 2);
            const last = candles[candles.length - 1];
            if (last && last.length >= 6) {
              const [t, o, h, l, c, v] = last;
              socketBus.emit('market:ohlcv', { symbol, timeframe: tf, t, o, h, l, c, v });

              // Trigger live prediction once per new candle per symbol/tf
              const key = `${symbol}|${tf}`;
              const prev = lastTs[key];
              if (!prev || prev < t) {
                lastTs[key] = t;
                // Fire and forget predictions for all agents that have a model
                queueMicrotask(async () => {
                  try {
                    const agents = await prisma.agent.findMany({ where: { modelPath: { not: null } }, select: { id: true, name: true, strategyId: true } });
                    const dbSymbol = toDbSymbol(symbol);
                    await Promise.allSettled(agents.map(a => predictForAgent({
                      agentId: a.id,
                      strategyId: a.strategyId,
                      symbol: dbSymbol,
                      timeframe: tf,
                      lookback: 128,
                    })));
                  } catch (err: any) {
                    log.error('Prediction dispatch failed', { symbol, timeframe: tf, error: err?.message });
                  }
                });
              }
            }
          } catch (err: any) {
            log.error('Failed to fetch OHLCV', { symbol, timeframe: tf, error: err?.message });
          }
        }
      } catch {}
    }
  };
  // Emit once on start, then at interval
  tick();
  timer = setInterval(tick, Math.max(1000, CONFIG.ORDER_POLL_MS));
  log.info('Market streamer started', { intervalMs: Math.max(1000, CONFIG.ORDER_POLL_MS), symbols });
}

export function stopMarketStreamer() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
