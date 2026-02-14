import { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';

/**
 * Colorized HTTP request logger middleware.
 * Logs method, URL, status code, response time, and content length
 * directly to stdout with chalk colors for quick visual scanning.
 *
 * @example
 * ← GET    /api/v1/users/me                200  12ms
 * ← POST   /api/v1/bookings                201  45ms   234B
 * ← GET    /api/v1/businesses/abc/slots     404   8ms
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const contentLength = res.getHeader('content-length');

    // Skip health checks to reduce noise
    if (url === '/health' || url === '/health/ready') return;

    const methodStr = colorMethod(method.padEnd(7));
    const statusStr = colorStatus(status);
    const timeStr = colorTime(durationMs);
    const sizeStr = contentLength ? chalk.dim(`${contentLength}B`) : '';
    const idStr = req.requestId ? chalk.dim(req.requestId.slice(0, 8)) : '';

    const line = `  ${chalk.gray('←')} ${methodStr} ${chalk.white(url.padEnd(45))} ${statusStr}  ${timeStr}  ${sizeStr}  ${idStr}`;

    process.stdout.write(`${line}\n`);
  });

  next();
};

/** Color the HTTP method */
const colorMethod = (method: string): string => {
  switch (method.trim()) {
    case 'GET':
      return chalk.green(method);
    case 'POST':
      return chalk.yellow(method);
    case 'PUT':
      return chalk.blue(method);
    case 'PATCH':
      return chalk.cyan(method);
    case 'DELETE':
      return chalk.red(method);
    default:
      return chalk.white(method);
  }
};

/** Color the status code */
const colorStatus = (status: number): string => {
  const str = String(status);
  if (status >= 500) return chalk.red.bold(str);
  if (status >= 400) return chalk.yellow(str);
  if (status >= 300) return chalk.cyan(str);
  if (status >= 200) return chalk.green(str);
  return chalk.white(str);
};

/** Color the response time */
const colorTime = (ms: number): string => {
  const str = `${ms.toFixed(0)}ms`.padStart(6);
  if (ms > 1000) return chalk.red.bold(str);
  if (ms > 500) return chalk.red(str);
  if (ms > 200) return chalk.yellow(str);
  return chalk.green(str);
};
