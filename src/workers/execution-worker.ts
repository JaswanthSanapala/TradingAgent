import { Job,Worker } from 'bullmq';

import { cancelOrder, placeOcoOrder,placeOrder } from '@/lib/broker';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { BrokerJobData,connection } from '@/lib/queue';
import { socketBus } from '@/lib/socket-bus';

const log = createLogger('ExecutionWorker');

let started = false;

export function startExecutionWorker() {
  if (started) return;
  started = true;

  const worker = new Worker<BrokerJobData>(
    'broker_exec',
    async (job: Job<BrokerJobData>) => {
      const data = job.data;
      log.info('Exec job start', { jobId: job.id, action: data.action });
      if (data.action === 'place') {
        const res = await placeOrder({ symbol: data.symbol, side: data.side, type: data.type, amount: data.amount, price: data.price, params: data.params });
        try { socketBus.emit('order:updated', { phase: 'placed', symbol: data.symbol, order: res, ts: new Date().toISOString() }); } catch {}
        try {
          const filled = Number(res.filled ?? 0);
          const status = String(res.status ?? '').toLowerCase();
          const isFilled = filled > 0 || status === 'closed';
          if (isFilled && data.agentId && data.strategyId) {
            const price: number = Number((res.average ?? res.price ?? data.price) as number);
            const tsMs: number = Number((res.timestamp ?? Date.now()) as number);
            const symbol = data.symbol;
            const orderId = String(res.id ?? '');

            if (data.side === 'sell') {
              // Close the latest open BUY trade if exists
              const open = await prisma.trade.findFirst({
                // Cast to any to avoid TS mismatch until `prisma generate` picks schema changes
                where: { agentId: data.agentId, strategyId: data.strategyId, symbol, status: 'open', action: 'buy' } as any,
                orderBy: { entryTime: 'desc' },
              });
              if (open) {
                const pnl = (price - open.entryPrice) * open.positionSize;
                const pnlPct = ((price - open.entryPrice) / open.entryPrice) * 100;
                await prisma.trade.update({
                  where: { id: open.id },
                  data: {
                    exitTime: new Date(tsMs),
                    exitPrice: price,
                    pnl: pnl,
                    pnlPercent: pnlPct,
                    status: 'closed',
                  },
                });
                try { socketBus.emit('trade:updated', { type: 'closed', id: open.id, symbol, exitPrice: price, pnl, pnlPct, ts: new Date().toISOString() }); } catch {}
                return { order: res, closedTradeId: open.id };
              }
            } else {

            // Otherwise, create a new open trade (BUY opens long; SELL opens short for systems supporting it)
            await prisma.trade.create({
              data: {
                agentId: data.agentId,
                strategyId: data.strategyId,
                symbol,
                exchangeOrderId: orderId || null,
                entryTime: new Date(tsMs),
                entryPrice: price,
                stopLoss: Number(data.stopLoss ?? 0),
                takeProfit: Number(data.takeProfit ?? 0),
                positionSize: Number(res.amount ?? data.amount ?? 0),
                action: data.side as any,
                status: 'open',
              } as any,
            });
            try { socketBus.emit('trade:updated', { type: 'opened', symbol, entryPrice: price, size: Number(res.amount ?? data.amount ?? 0), stopLoss: Number(data.stopLoss ?? 0) || null, takeProfit: Number(data.takeProfit ?? 0) || null, ts: new Date().toISOString() }); } catch {}

            // Attempt OCO placement for TP/SL on BUY fills (Binance spot best-effort)
            try {
              if (data.side === 'buy' && Number(data.stopLoss) > 0 && Number(data.takeProfit) > 0) {
                await placeOcoOrder({ symbol, side: 'sell', amount: Number(res.amount ?? data.amount ?? 0), takeProfit: Number(data.takeProfit), stopLoss: Number(data.stopLoss) });
                try { socketBus.emit('order:updated', { phase: 'oco_submitted', symbol, tp: Number(data.takeProfit), sl: Number(data.stopLoss), ts: new Date().toISOString() }); } catch {}
              }
            } catch (e: any) {
              // Fallback to watcher; just log
              log.warn('OCO placement failed or unsupported; relying on TP/SL watcher', { symbol, error: e?.message });
            }
            }
          } else if (!isFilled && data.agentId && data.strategyId) {
            // Save pending order for poller
            try {
              const po = await (prisma as any).pendingOrder.create({
                data: {
                  agentId: data.agentId,
                  strategyId: data.strategyId,
                  symbol: data.symbol,
                  exchangeOrderId: String(res.id || ''),
                  side: data.side as any,
                  type: data.type,
                  amount: Number(res.amount ?? data.amount ?? 0),
                  price: Number((res.price ?? data.price) ?? 0) || null as any,
                  status: String(res.status ?? 'open').toLowerCase(),
                } as any,
              });
              try { socketBus.emit('order:updated', { phase: 'pending', symbol: data.symbol, orderId: String(res.id||''), pendingId: po?.id, ts: new Date().toISOString() }); } catch {}
            } catch (e) {
              log.error('Failed to persist PendingOrder', { error: (e as any)?.message });
            }
          }
        } catch (err) {
          log.error('Failed to persist Trade after order placement', { error: (err as any)?.message });
        }
        return { order: res };
      } else if (data.action === 'cancel') {
        const res = await cancelOrder({ orderId: data.orderId, symbol: data.symbol, params: data.params });
        try { socketBus.emit('order:updated', { phase: 'canceled', symbol: data.symbol, orderId: data.orderId, ts: new Date().toISOString() }); } catch {}
        return { canceled: res };
      }
      throw new Error('Unknown broker action');
    },
    { connection }
  );

  worker.on('completed', (job) => log.info('Exec job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => log.error('Exec job failed', { jobId: job?.id, error: err?.message }));

  log.info('Execution worker started');
}
