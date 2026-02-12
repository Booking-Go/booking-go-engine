import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { pgPool, redisClient } from './config';
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

// ─── Bootstrap ──────────────────────────────────────────────────────────────
dotenv.config();

const app: Application = express();
// Trust first proxy (Cloudflare Tunnel / reverse proxy)
app.set('trust proxy', 1);

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
morgan.token('request-id', (req) => (req as express.Request).requestId);
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    checks.postgres = { status: 'down', latencyMs: Date.now() - pgStart, error: message };
  }

  // MongoDB
  const mongoStart = Date.now();
  try {
    const mongoState = mongoose.connection.readyState; // 1 = connected
    checks.mongodb = {
      status: mongoState === 1 ? 'up' : 'down',
      latencyMs: Date.now() - mongoStart,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    checks.mongodb = { status: 'down', latencyMs: Date.now() - mongoStart, error: message };
  }

  // Redis
  const redisStart = Date.now();
  try {
    await redisClient.ping();
    checks.redis = { status: 'up', latencyMs: Date.now() - redisStart };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    checks.redis = { status: 'down', latencyMs: Date.now() - redisStart, error: message };
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

export default app;
