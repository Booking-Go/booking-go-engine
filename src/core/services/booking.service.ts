import { logger } from '../../libs';

import type { CreateBookingInput, UpdateBookingInput, CancelBookingInput } from '../validators';

/**
 * Booking service — business logic for the booking lifecycle.
 */
export const bookingService = {
  async create(customerId: string, input: CreateBookingInput) {
    // TODO: Implement in Sprint 6
    // 1. Find slot, verify it's available
    // 2. Start PG transaction
    // 3. Lock slot row (SELECT FOR UPDATE — prevent double booking)
    // 4. Create booking record
    // 5. Update slot status to 'booked'
    // 6. Commit transaction
    // 7. Invalidate slot cache
    // 8. Trigger notification
    // 9. Return booking
    logger.debug('bookingService.create', { customerId });
    throw new Error('Not implemented');
  },

  async getById(bookingId: string, requesterId: string) {
    // TODO: Implement in Sprint 6
    logger.debug('bookingService.getById', { bookingId, requesterId });
    throw new Error('Not implemented');
  },

  async listForUser(userId: string, role: string, page: number, limit: number) {
    // TODO: Implement in Sprint 6
    logger.debug('bookingService.listForUser', { userId, role, page, limit });
    throw new Error('Not implemented');
  },

  async confirm(bookingId: string, ownerId: string) {
    // TODO: Implement in Sprint 6
    // 1. Verify booking exists and is pending
    // 2. Verify requester owns the business
    // 3. Update status to 'confirmed'
    // 4. Trigger notification to customer
    logger.debug('bookingService.confirm', { bookingId, ownerId });
    throw new Error('Not implemented');
  },

  async cancel(bookingId: string, requesterId: string, input: CancelBookingInput) {
    // TODO: Implement in Sprint 6
    // 1. Verify booking exists and is cancellable
    // 2. Update booking status to 'cancelled'
    // 3. Release slot (set status back to 'available')
    // 4. Invalidate slot cache
    // 5. Trigger notification
    logger.debug('bookingService.cancel', { bookingId, requesterId });
    throw new Error('Not implemented');
  },

  async complete(bookingId: string, ownerId: string) {
    // TODO: Implement in Sprint 6
    // 1. Verify booking is confirmed
    // 2. Update status to 'completed'
    // 3. Trigger notification
    logger.debug('bookingService.complete', { bookingId, ownerId });
    throw new Error('Not implemented');
  },

  async update(bookingId: string, requesterId: string, input: UpdateBookingInput) {
    // TODO: Implement in Sprint 6
    logger.debug('bookingService.update', { bookingId, requesterId });
    throw new Error('Not implemented');
  },
};
