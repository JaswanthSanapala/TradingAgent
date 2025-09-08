import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { getTickerPrice } from '@/lib/broker';
import { prisma } from '@/lib/db';
import { queues, defaultJobOpts } from '@/lib/queue';
import { socketBus } from '@/lib/socket-bus';

const log = createLogger('TpSlWatcher');

let started = false;
let timer: NodeJS.Timeout | null = null;
let running = false;

export function startTpSlWatcher() {
  if (started) return;
  started = true;
  if (!CONFIG.EXECUTION_ENABLED) {
    log.info('Execution disabled; TP/SL watcher not started');
    return;
  }
  const tick = async () => {
    if (running) return; running = true;
    try {
      const openTrades = await prisma.trade.findMany({ where: { status: 'open' } as any, take: 100, orderBy: { createdAt: 'asc' } });
      for (const t of openTrades) {
        try {
          // Cast to any until `prisma generate` picks up `symbol` on Trade
          const symbol = (t as any).symbol as string;
          const price = await getTickerPrice(symbol);
          const isLong = t.action === 'buy';
          const hitSL = t.stopLoss > 0 && ((isLong && price <= t.stopLoss) || (!isLong && price >= t.stopLoss));
          const hitTP = t.takeProfit > 0 && ((isLong && price >= t.takeProfit) || (!isLong && price <= t.takeProfit));
          if (!hitSL && !hitTP) continue;
          const side = isLong ? 'sell' : 'buy';
          try { socketBus.emit('order:updated', { phase: 'tp_sl_trigger', symbol, tradeId: t.id, price, hitSL, hitTP, ts: new Date().toISOString() }); } catch {}
          await queues.broker_exec.add('tp_sl_close', { action: 'place', symbol, side, type: 'market', amount: t.positionSize }, defaultJobOpts);
          try { socketBus.emit('order:updated', { phase: 'tp_sl_close_enqueued', symbol, tradeId: t.id, side, amount: t.positionSize, ts: new Date().toISOString() }); } catch {}
          log.info('TP/SL triggered; submitted close order', { tradeId: t.id, price, hitSL, hitTP });
        } catch (e: any) {
          log.error('Watcher error on trade', { tradeId: t.id, error: e?.message });
        }
      }
    } catch (e: any) {
      log.error('TP/SL watcher tick failed', { error: e?.message });
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, Math.max(2000, CONFIG.ORDER_POLL_MS));
  log.info('TP/SL watcher started', { intervalMs: Math.max(2000, CONFIG.ORDER_POLL_MS) });
}

export function stopTpSlWatcher() {
  if (timer) clearInterval(timer);
  timer = null; started = false;
}
