import http from 'http';

import {
  connectPostgres,
  connectMongoDB,
  connectRedis,
  connectOllama,
  closePostgres,
  closeMongoDB,
  closeRedis,
  closeOllama,
} from './config';
import { initFirebase } from './config/firebase';
import { logger } from './libs';
import { initializeSocket } from './socket';
import app from './app';

// ─── Server bootstrap & graceful shutdown ───────────────────────────────────
const PORT = process.env.PORT || 8000;
let server: http.Server;

const startServer = async () => {
  try {
    // Connect to databases
    await connectPostgres();
    await connectMongoDB();
    await connectRedis();

    // Initialize Firebase (push notifications)
    initFirebase();

    // Connect to Ollama (AI — non-blocking, app works without it)
    await connectOllama();

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        apiBase: `http://localhost:${PORT}/api/v1`,
      });
    });

    // Initialize Socket.IO on the HTTP server
    initializeSocket(server);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await Promise.allSettled([closePostgres(), closeMongoDB(), closeRedis()]);
          closeOllama();
          logger.info('All database connections closed');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown', { error: err });
          process.exit(1);
        }
      });

      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled rejections / exceptions
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception — shutting down', { error: err.message, stack: err.stack });
      shutdown('uncaughtException');
    });
  } catch (err: unknown) {
    logger.error('Failed to start server', { error: err instanceof Error ? err.message : err });
    process.exit(1);
  }
};

startServer();

export default app;
