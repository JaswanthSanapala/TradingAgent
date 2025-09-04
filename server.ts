// server.ts - Next.js Standalone + Socket.IO
import 'dotenv/config';
import { setupSocket } from '@/lib/socket';
import { CONFIG } from '@/lib/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { startScheduler } from '@/lib/scheduler';
import { startSupervisedWorker } from '@/workers/supervised-worker';
import { startDataBackfillWorker } from '@/workers/data-backfill-worker';
import { startDataExportWorker } from '@/workers/data-export-worker';
import { startDataWindowsWorker } from '@/workers/data-windows-worker';
import { startCoverageWorker, scheduleCoverageTick } from '@/workers/coverage-worker';

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
      // Start BullMQ supervised training worker
      startSupervisedWorker();
      console.log('> Workers: supervised training worker started');
      // Start data workers
      startDataBackfillWorker();
      startDataExportWorker();
      startDataWindowsWorker();
      console.log('> Workers: data workers started (backfill/export/windows)');
      // Start coverage worker and schedule repeatable tick
      startCoverageWorker();
      scheduleCoverageTick();
      console.log('> Workers: coverage worker started with repeatable tick');
    });

  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

// Start the server
createCustomServer();
