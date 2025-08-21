import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { DataPipeline, DataPipelineConfig } from '@/lib/data-pipeline';
import { CONFIG } from '@/lib/config';

const log = createLogger('Scheduler');

// How far each job should cover in milliseconds per chunk
const DEFAULT_CHUNK_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const DEFAULT_TICK_MS = 15_000; // run planner every 15s

export class CoverageScheduler {
  private static _instance: CoverageScheduler | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private pipeline: DataPipeline;

  private constructor(cfg?: Partial<DataPipelineConfig>) {
    const pipelineCfg: DataPipelineConfig = {
      exchange: {
        id: cfg?.exchange?.id || CONFIG.EXCHANGE_ID,
        apiKey: cfg?.exchange?.apiKey ?? CONFIG.EXCHANGE_API_KEY,
        secret: cfg?.exchange?.secret ?? CONFIG.EXCHANGE_SECRET,
        sandbox: cfg?.exchange?.sandbox ?? CONFIG.EXCHANGE_SANDBOX,
      },
      timeframes: cfg?.timeframes || CONFIG.TIMEFRAMES,
      indicators: cfg?.indicators || { atrPeriod: 14, cciPeriod: 20, smaPeriods: [20, 50], rsiPeriod: 14 },
      database: cfg?.database || { path: './db/custom.db', backupEnabled: false, cleanupDays: 0 },
      symbols: cfg?.symbols || CONFIG.SYMBOLS,
    };
    this.pipeline = new DataPipeline(pipelineCfg);
  }

  static get instance(): CoverageScheduler {
    if (!this._instance) this._instance = new CoverageScheduler();
    return this._instance;
  }

  start(intervalMs: number = (CONFIG.SCHEDULER_TICK_MS || DEFAULT_TICK_MS)) {
    if (this.timer) return;
    log.info(`Starting scheduler with tick=${intervalMs}ms`);
    this.timer = setInterval(() => this.tick().catch(e => log.error('Tick error', e)), intervalMs);
    // Run an immediate tick on start
    this.tick().catch(e => log.error('Initial tick error', e));
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      // 1) Ensure jobs exist for active manifests
      await this.planJobs();
      // 2) Execute next pending job (one at a time to be safe)
      await this.executeNextJob();
    } catch (e) {
      log.error('Scheduler tick failed', e);
    } finally {
      this.running = false;
    }
  }

  private async planJobs() {
    const manifests = await prisma.coverageManifest.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'asc' },
    });

    const now = new Date();

    for (const m of manifests) {
      const last = m.lastCoveredTo ?? m.startDate;
      // if already covered to endDate (or now if endDate in future), skip
      const targetEnd = m.endDate > now ? now : m.endDate;
      if (last >= targetEnd) continue;

      // Create chunked jobs between last and targetEnd if none pending/running for this manifest
      const hasActive = await prisma.ingestJob.count({ where: { manifestId: m.id, status: { in: ['pending', 'running'] } } });
      if (hasActive > 0) continue;

      const jobs: any[] = [];
      let cursor = last;
      while (cursor < targetEnd) {
        const next = new Date(Math.min(cursor.getTime() + DEFAULT_CHUNK_MS, targetEnd.getTime()));
        jobs.push({
          manifestId: m.id,
          symbol: m.symbol,
          timeframe: m.timeframe,
          exchangeId: m.exchangeId,
          rangeStart: new Date(cursor),
          rangeEnd: new Date(next),
          status: 'pending' as const,
        });
        cursor = next;
      }
      if (jobs.length) {
        await prisma.ingestJob.createMany({ data: jobs });
        log.info(`Planned ${jobs.length} jobs for manifest ${m.id} ${m.symbol} ${m.timeframe}`);
      }
    }
  }

  private async executeNextJob() {
    // Acquire one pending job oldest first
    const job = await prisma.ingestJob.findFirst({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } });
    if (!job) return;

    // mark running
    await prisma.ingestJob.update({ where: { id: job.id }, data: { status: 'running', startedAt: new Date(), error: null } });

    try {
      const inserted = await this.pipeline.backfillRange(job.symbol, job.timeframe, job.rangeStart, job.rangeEnd);

      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: 'completed', finishedAt: new Date(), inserted: inserted.inserted } });

      // advance manifest lastCoveredTo
      const coveredTo = job.rangeEnd;
      await prisma.coverageManifest.update({ where: { id: job.manifestId }, data: { lastCoveredTo: coveredTo, updatedAt: new Date() } });

      log.info(`Job ${job.id} completed with ${inserted.inserted} rows`);
    } catch (e: any) {
      const message = e?.message || String(e);
      await prisma.ingestJob.update({ where: { id: job.id }, data: { status: 'failed', finishedAt: new Date(), error: message } });
      log.error(`Job ${job.id} failed`, e);
    }
  }
}

// Helper to start singleton scheduler
export function startScheduler() {
  CoverageScheduler.instance.start();
}
