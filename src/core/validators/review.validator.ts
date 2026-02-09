import { z } from 'zod';

import { AppConfig } from '../constants';

export const createReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(AppConfig.REVIEW_MIN_RATING, `Minimum rating is ${AppConfig.REVIEW_MIN_RATING}`)
    .max(AppConfig.REVIEW_MAX_RATING, `Maximum rating is ${AppConfig.REVIEW_MAX_RATING}`),
  comment: z.string().max(1000).optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
