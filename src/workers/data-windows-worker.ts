import { Worker, Job } from 'bullmq';
import { connection, WindowsJobData } from '@/lib/queue';
import { prisma } from '@/lib/db';
import { buildUnsupervisedWindows } from '@/lib/window-builder';

export function startDataWindowsWorker() {
  const worker = new Worker<WindowsJobData>(
    'data_windows',
    async (job: Job<WindowsJobData>) => {
      const { datasetId, from, to, windowSize, stride, maskRatio } = job.data;
      const dataset = await prisma.coverageManifest.findUnique({ where: { id: datasetId } });
      if (!dataset) throw new Error(`dataset not found: ${datasetId}`);

      const start = from ? new Date(from) : dataset.startDate;
      const end = to ? new Date(to) : dataset.endDate;
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('invalid from/to');

      const ccxtSymbol = dataset.symbol.replace('_', '/');
      const { windows, filePath } = await buildUnsupervisedWindows({
        symbol: ccxtSymbol,
        timeframe: dataset.timeframe,
        start,
        end,
        windowSize,
        stride,
        maskRatio,
      });
      return { count: windows, filePath };
    },
    { connection }
  );

  worker.on('failed', (job, err) => {
    console.error('[data_windows] failed', job?.id, err);
  });

  return worker;
}
