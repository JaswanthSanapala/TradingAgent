// server.ts - Next.js Standalone + Socket.IO
import 'dotenv/config';

import { createServer } from 'http';
import next from 'next';
import { Server } from 'socket.io';

import { CONFIG } from '@/lib/config';
import { PrismaMarketProvider } from '@/lib/market/providers/prisma-provider';
import { MarketRegistry } from '@/lib/market/registry';
import { startScheduler } from '@/lib/scheduler';
import { setupSocket } from '@/lib/socket';
import { scheduleCoverageTick,startCoverageWorker } from '@/workers/coverage-worker';
import { startDataBackfillWorker } from '@/workers/data-backfill-worker';
import { startDataExportWorker } from '@/workers/data-export-worker';
import { startDataWindowsWorker } from '@/workers/data-windows-worker';
import { startExecutionWorker } from '@/workers/execution-worker';
import { startIngestionWorker } from '@/workers/ingestion-worker';
import { startMarketStreamer } from '@/workers/market-streamer';
import { startOrderPoller } from '@/workers/order-poller';
import { startRLWorker } from '@/workers/rl-worker';
import { startSupervisedWorker } from '@/workers/supervised-worker';
import { startTpSlWatcher } from '@/workers/tp-sl-watcher';

const dev = process.env.NODE_ENV !== 'production';
const currentPort = CONFIG.PORT;
const hostname = CONFIG.HOSTNAME;

// Custom server with Socket.IO integration
async function createCustomServer() {
  try {
    // Create Next.js app
    const nextApp = next({ 
      dev,
      dir: process.cwd(),
      // In production, use the current directory where .next is located
      conf: dev ? undefined : { distDir: './.next' }
    });

    await nextApp.prepare();
    const handle = nextApp.getRequestHandler();

    // Create HTTP server that will handle both Next.js and Socket.IO
    const server = createServer((req, res) => {
      // Skip socket.io requests from Next.js handler
      if (req.url?.startsWith('/api/socketio')) {
        return;
      }
      handle(req, res);
    });

    // Setup Socket.IO
    const io = new Server(server, {
      path: '/api/socketio',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    setupSocket(io);

    // Register default market provider (Prisma-backed)
    try {
      MarketRegistry.set(new PrismaMarketProvider());
    } catch {}

    // Start the server
    server.listen(currentPort, hostname, () => {
      console.log(`> Ready on http://${hostname}:${currentPort}`);
      console.log(`> Socket.IO server running at ws://${hostname}:${currentPort}/api/socketio`);
      // Start coverage scheduler once server is ready (unless disabled)
      const enabled = CONFIG.SCHEDULER_ENABLED;
      if (enabled) {
        startScheduler();
        console.log('> Coverage scheduler: ENABLED');
      } else {
        console.log('> Coverage scheduler: DISABLED via SCHEDULER_ENABLED=false');
      }

      // Start market streamer only if explicitly enabled and symbols configured
      if (CONFIG.MARKET_STREAMER_ENABLED && (CONFIG.SYMBOLS && CONFIG.SYMBOLS.length > 0)) {
        try {
          startMarketStreamer();
          console.log('> Workers: market streamer started');
        } catch (e) {
          console.log('> Workers: market streamer failed to start', e);
        }
      } else {
        console.log('> Workers: market streamer DISABLED (set MARKET_STREAMER_ENABLED=true and provide SYMBOLS to enable)');
      }

      // Start Redis-dependent workers only if REDIS_ENABLED
      if (CONFIG.REDIS_ENABLED) {
        // Start BullMQ supervised training worker
        if (CONFIG.SUPERVISED_WORKER_ENABLED) {
          startSupervisedWorker();
          console.log('> Workers: supervised training worker started');
        } else {
          console.log('> Workers: supervised training worker DISABLED');
        }

        // Start RL worker
        startRLWorker();
        console.log('> Workers: RL worker started');
        // Start Ingestion worker
        startIngestionWorker();
        console.log('> Workers: ingestion worker started');
        // Start data workers
        startDataBackfillWorker();
        startDataExportWorker();
        startDataWindowsWorker();
        console.log('> Workers: data workers started (backfill/export/windows)');
        // Start execution worker
        startExecutionWorker();
        console.log('> Workers: broker execution worker started');
        // Start order poller
        startOrderPoller();
        console.log('> Workers: order poller started');
        // Start TP/SL watcher
        startTpSlWatcher();
        console.log('> Workers: TP/SL watcher started');
        // Start coverage worker and schedule repeatable tick
        startCoverageWorker();
        scheduleCoverageTick();
        console.log('> Workers: coverage worker started with repeatable tick');
      } else {
        console.log('> Redis-dependent workers are DISABLED (set REDIS_ENABLED=true to enable)');
      }
    });

  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

// Start the server
createCustomServer();
