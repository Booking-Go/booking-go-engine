/* eslint-disable @typescript-eslint/no-unused-vars */
import { Request } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Unique correlation ID injected by the requestId middleware. */
    requestId: string;
  }
}
