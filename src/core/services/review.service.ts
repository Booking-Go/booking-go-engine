import { logger } from '../../libs';

import type { CreateReviewInput } from '../validators';

/**
 * Review service — business logic for reviews.
 */
export const reviewService = {
  async create(bookingId: string, customerId: string, input: CreateReviewInput) {
    // TODO: Implement in Sprint 7
    // 1. Verify booking is completed and belongs to customer
    // 2. Verify no existing review for this booking
    // 3. Create review
    // 4. Recalculate business average rating
    // 5. Trigger notification to business owner
    logger.debug('reviewService.create', { bookingId, customerId });
    throw new Error('Not implemented');
  },

  async getByBusinessId(businessId: string, page: number, limit: number) {
    // TODO: Implement in Sprint 7
    logger.debug('reviewService.getByBusinessId', { businessId, page, limit });
    throw new Error('Not implemented');
  },
};
