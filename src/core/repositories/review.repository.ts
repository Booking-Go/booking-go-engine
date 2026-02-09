import { logger } from '../../libs';

/**
 * Review repository — PostgreSQL data access for the reviews table.
 */
export const reviewRepository = {
  async findById(id: string) {
    // TODO: Implement in Sprint 7
    logger.debug('reviewRepository.findById', { id });
    throw new Error('Not implemented');
  },

  async findByBusinessId(businessId: string, page: number, limit: number) {
    // TODO: Implement in Sprint 7
    logger.debug('reviewRepository.findByBusinessId', { businessId, page, limit });
    throw new Error('Not implemented');
  },

  async findByBookingId(bookingId: string) {
    // TODO: Implement in Sprint 7
    logger.debug('reviewRepository.findByBookingId', { bookingId });
    throw new Error('Not implemented');
  },

  async create(data: Record<string, unknown>) {
    // TODO: Implement in Sprint 7
    logger.debug('reviewRepository.create');
    throw new Error('Not implemented');
  },

  async getAverageRating(businessId: string): Promise<number> {
    // TODO: Implement in Sprint 7
    logger.debug('reviewRepository.getAverageRating', { businessId });
    throw new Error('Not implemented');
  },
};
