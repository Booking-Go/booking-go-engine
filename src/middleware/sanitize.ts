import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import { Router } from 'express';

/**
 * Combines data-sanitization middleware into a single mountable mini-router.
 *
 * - **express-mongo-sanitize** — strips `$` and `.` from user input to prevent
 *   NoSQL operator injection (e.g., `{ "$gt": "" }` in query strings or body).
 * - **hpp** — protects against HTTP Parameter Pollution by picking the last
 *   value when a parameter appears multiple times (e.g., `?sort=name&sort=date`).
 */
const sanitizeRouter = Router();

sanitizeRouter.use(mongoSanitize());
sanitizeRouter.use(hpp());

export { sanitizeRouter as sanitize };
