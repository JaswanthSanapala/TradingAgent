import { Worker, Job } from 'bullmq';
import { connection, ExportJobData } from '@/lib/queue';
import { prisma } from '@/lib/db';
import { exportToParquet } from '@/lib/exporter';

export function startDataExportWorker() {
  const worker = new Worker<ExportJobData>(
    'data_export',
    async (job: Job<ExportJobData>) => {
      const { datasetId, from, to } = job.data;
      const dataset = await prisma.coverageManifest.findUnique({ where: { id: datasetId } });
      if (!dataset) throw new Error(`dataset not found: ${datasetId}`);

      const start = from ? new Date(from) : dataset.startDate;
      const end = to ? new Date(to) : dataset.endDate;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('invalid from/to');

      const ccxtSymbol = dataset.symbol.replace('_', '/');
      const { rows, filePath } = await exportToParquet({ symbol: ccxtSymbol, timeframe: dataset.timeframe, start, end });
      return { rows, filePath };
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[data_export] failed', job?.id, err);
  });

  return worker;
}
