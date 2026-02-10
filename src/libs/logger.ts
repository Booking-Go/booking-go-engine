import winston from 'winston';

/* ─── Production format: structured JSON ─── */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

/* ─── Dev format: coloured human-readable lines ─── */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'booking-go-engine' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? logFormat : devFormat,
    }),
    // Production file transports (uncomment when needed)
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

/**
 * Create a child logger scoped to a specific request.
 * Automatically attaches the requestId to every log entry.
 *
 * Usage inside routes / services:
 *   const log = createRequestLogger(req.requestId);
 *   log.info('Booking created', { bookingId });
 */
export const createRequestLogger = (requestId: string) => {
  return logger.child({ requestId });
};

export { logger };
