import { z } from 'zod';

import { Pagination } from '../constants';

/**
 * Common query parameter validators reusable across endpoints.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(Pagination.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(Pagination.MAX_LIMIT).default(Pagination.DEFAULT_LIMIT),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;
