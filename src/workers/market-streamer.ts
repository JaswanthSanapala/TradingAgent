import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { getTickerPrice } from '@/lib/broker';
import { socketBus } from '@/lib/socket-bus';

const log = createLogger('MarketStreamer');

let started = false;
let timer: NodeJS.Timeout | null = null;

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
