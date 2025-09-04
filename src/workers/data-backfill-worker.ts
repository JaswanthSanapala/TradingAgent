import { Worker, Job } from 'bullmq';
import { connection, BackfillJobData } from '@/lib/queue';
import { prisma } from '@/lib/db';
import { DataPipeline } from '@/lib/data-pipeline';
import { CONFIG } from '@/lib/config';

export function startDataBackfillWorker() {
  const worker = new Worker<BackfillJobData>(
    'data_backfill',
    async (job: Job<BackfillJobData>) => {
      const { datasetId, from, to } = job.data;
      const dataset = await prisma.coverageManifest.findUnique({ where: { id: datasetId } });
      if (!dataset) throw new Error(`dataset not found: ${datasetId}`);

      const pipeline = new DataPipeline({
        exchange: {
          id: dataset.exchangeId || CONFIG.EXCHANGE_ID,
          apiKey: CONFIG.EXCHANGE_API_KEY,
          secret: CONFIG.EXCHANGE_SECRET,
          sandbox: CONFIG.EXCHANGE_SANDBOX,
        },
        timeframes: CONFIG.TIMEFRAMES,
        indicators: { atrPeriod: 14, cciPeriod: 20, smaPeriods: [20, 50], rsiPeriod: 14 },
        database: { path: './db/custom.db', backupEnabled: false, cleanupDays: 0 },
        symbols: [dataset.symbol.replace('_', '/')],
      });

      const start = from ? new Date(from) : dataset.lastCoveredTo ?? dataset.startDate;
      const now = new Date();
      const end = to ? new Date(to) : (dataset.endDate > now ? now : dataset.endDate);
      if (start >= end) return { inserted: 0, message: 'Already up to date' };

      const ccxtSymbol = dataset.symbol.replace('_', '/');
      const res = await pipeline.backfillRange(ccxtSymbol, dataset.timeframe, start, end);

      await prisma.coverageManifest.update({ where: { id: datasetId }, data: { lastCoveredTo: end, updatedAt: new Date() } });
      return { inserted: res.inserted };
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[data_backfill] failed', job?.id, err);
  });

  return worker;
}
