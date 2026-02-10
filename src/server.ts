import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';

import {
  connectPostgres,
  connectMongoDB,
  connectRedis,
  closePostgres,
  closeMongoDB,
  closeRedis,
  pgPool,
  redisClient,
} from './config';
import {
  errorHandler,
  rateLimiter,
  requestId,
  sanitize,
  notFoundHandler,
  activityLogger,
} from './middleware';
import { logger } from './libs';
import router from './routes';
import mongoose from 'mongoose';

// ─── Bootstrap ──────────────────────────────────────────────────────────────
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

// ─── 1. Security headers ───────────────────────────────────────────────────
app.use(helmet());

// ─── 2. CORS ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

// ─── 3. Request ID (correlation) ────────────────────────────────────────────
app.use(requestId);

// ─── 4. HTTP request logging (attach requestId to morgan tokens) ────────────
morgan.token('request-id', (req) => (req as any).requestId);
app.use(
  morgan(':method :url :status :response-time ms - :request-id', {
    stream: { write: (msg: string) => logger.http(msg.trim()) },
  }),
);

// ─── 5. Body parsing ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─── 6. Input sanitization (NoSQL injection + HPP) ─────────────────────────
app.use(sanitize);

// ─── 7. Rate limiting ──────────────────────────────────────────────────────
app.use(rateLimiter);

// ─── 8. Activity logger (fires on response finish for mutating requests) ───
app.use(activityLogger);

// ─── 9. Health checks ──────────────────────────────────────────────────────

/** Liveness probe — is the process alive? */
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

/** Readiness probe — are all dependencies reachable? */
app.get('/health/ready', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // PostgreSQL
  const pgStart = Date.now();
  try {
    await pgPool.query('SELECT 1');
    checks.postgres = { status: 'up', latencyMs: Date.now() - pgStart };
  } catch (err: any) {
    checks.postgres = { status: 'down', latencyMs: Date.now() - pgStart, error: err.message };
  }

  // MongoDB
  const mongoStart = Date.now();
  try {
    const mongoState = mongoose.connection.readyState; // 1 = connected
    checks.mongodb = {
      status: mongoState === 1 ? 'up' : 'down',
      latencyMs: Date.now() - mongoStart,
    };
  } catch (err: any) {
    checks.mongodb = { status: 'down', latencyMs: Date.now() - mongoStart, error: err.message };
  }

  // Redis
  const redisStart = Date.now();
  try {
    await redisClient.ping();
    checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
  } catch (err: any) {
    checks.redis = { status: 'down', latencyMs: Date.now() - redisStart, error: err.message };
  }

  const allUp = Object.values(checks).every((c) => c.status === 'up');

  res.status(allUp ? 200 : 503).json({
    status: allUp ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// ─── 10. API Routes (versioned) ─────────────────────────────────────────────
app.use(router);

// ─── 11. 404 catch-all ──────────────────────────────────────────────────────
app.use(notFoundHandler);

// ─── 12. Global error handler (MUST be last) ────────────────────────────────
app.use(errorHandler);

// ─── Server bootstrap & graceful shutdown ───────────────────────────────────
let server: http.Server;

const startServer = async () => {
  try {
    // Connect to databases
    await connectPostgres();
    await connectMongoDB();
    await connectRedis();

    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        apiBase: `http://localhost:${PORT}/api/v1`,
      });
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — starting graceful shutdown`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await Promise.allSettled([closePostgres(), closeMongoDB(), closeRedis()]);
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
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();

export default app;
