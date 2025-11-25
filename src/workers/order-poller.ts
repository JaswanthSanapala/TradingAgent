import { fetchOrder } from '@/lib/trading/broker';
import { CONFIG } from '@/lib/core/config';
import { prisma } from '@/lib/core/db';
import { createLogger } from '@/lib/core/logger';
import { socketBus } from '@/lib/sockets/socket-bus';

const log = createLogger('OrderPoller');

let started = false;
let timer: NodeJS.Timeout | null = null;
let running = false;

export function startOrderPoller() {
  if (started) return;
  started = true;
  if (!CONFIG.EXECUTION_ENABLED) {
    log.info('Execution disabled; order poller not started');
    return;
  }
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const pendings: any[] = await (prisma as any).pendingOrder.findMany({ where: { status: 'open' }, take: 50, orderBy: { createdAt: 'asc' } });
      for (const po of pendings) {
        try {
          const ord = await fetchOrder(po.symbol, po.exchangeOrderId);
          const status = String(ord?.status ?? '').toLowerCase();
          const filled = Number(ord?.filled ?? 0);
          const isClosed = status === 'closed' || filled > 0;
          if (!isClosed) continue;

          const price: number = Number((ord?.average ?? ord?.price) ?? 0);
          const tsMs: number = Number((ord?.timestamp ?? Date.now()) as number);

          if (po.side === 'sell') {
            // Close last open BUY
            const open = await prisma.trade.findFirst({ where: { agentId: po.agentId, strategyId: po.strategyId, symbol: po.symbol, status: 'open', action: 'buy' } as any, orderBy: { entryTime: 'desc' } });
            if (open) {
              const pnl = (price - open.entryPrice) * open.positionSize;
              const pnlPct = ((price - open.entryPrice) / open.entryPrice) * 100;
              await prisma.trade.update({ where: { id: open.id }, data: { exitTime: new Date(tsMs), exitPrice: price, pnl, pnlPercent: pnlPct, status: 'closed' } });
              try { socketBus.emit('trade:updated', { type: 'closed', id: open.id, symbol: po.symbol, exitPrice: price, pnl, pnlPct, ts: new Date(tsMs).toISOString() }); } catch {}
            }
          } else {
            // BUY filled -> open a trade
            await prisma.trade.create({
              data: {
                agentId: po.agentId,
                strategyId: po.strategyId,
                symbol: po.symbol,
                exchangeOrderId: po.exchangeOrderId,
                entryTime: new Date(tsMs),
                entryPrice: price,
                stopLoss: 0,
                takeProfit: 0,
                positionSize: Number(ord?.amount ?? po.amount ?? 0),
                action: 'buy' as any,
                status: 'open',
              } as any,
            });
            try { socketBus.emit('trade:updated', { type: 'opened', symbol: po.symbol, entryPrice: price, size: Number(ord?.amount ?? po.amount ?? 0), ts: new Date(tsMs).toISOString() }); } catch {}
          }

          await (prisma as any).pendingOrder.update({ where: { id: po.id }, data: { status: 'closed', updatedAt: new Date() } });
          try { socketBus.emit('order:updated', { phase: 'filled', symbol: po.symbol, orderId: po.exchangeOrderId, ts: new Date(tsMs).toISOString() }); } catch {}
        } catch (err) {
          log.error('Poller error for pending order', { id: po?.id, error: (err as any)?.message });
        }
      }
    } catch (e) {
      log.error('Order poller tick failed', { error: (e as any)?.message });
    } finally {
      running = false;
    }
  };
  timer = setInterval(tick, Math.max(2000, CONFIG.ORDER_POLL_MS));
  log.info('Order poller started', { intervalMs: Math.max(2000, CONFIG.ORDER_POLL_MS) });
}

export function stopOrderPoller() {
  if (timer) clearInterval(timer);
  timer = null;
  started = false;
}
