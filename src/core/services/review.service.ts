import { logger } from '../../libs';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, BookingStatus, NotificationType, Pagination } from '../constants';
import { reviewRepository } from '../repositories/review.repository';
import { bookingRepository } from '../repositories/booking.repository';
import { businessRepository } from '../repositories/business.repository';
import { notificationService } from './notification.service';

import type { CreateReviewInput } from '../validators';

/**
 * Review service — business logic for reviews.
 */
export const reviewService = {
  /**
   * Creates a review for a completed booking.
   * @param bookingId - The booking to review.
   * @param customerId - The customer writing the review.
   * @param input - Validated review data (rating, comment).
   */
  async create(bookingId: string, customerId: string, input: CreateReviewInput) {
    logger.debug('reviewService.create', { bookingId, customerId });

    // 1. Verify booking exists and is completed
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found', HttpStatus.NOT_FOUND);
    }
    if (booking.customer_id !== customerId) {
      throw new AppError('You can only review your own bookings', HttpStatus.FORBIDDEN);
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new AppError('You can only review completed bookings', HttpStatus.BAD_REQUEST);
    }

    // 2. Check no existing review
    const existing = await reviewRepository.findByBookingId(bookingId);
    if (existing) {
      throw new AppError('You have already reviewed this booking', HttpStatus.CONFLICT);
    }

    // 3. Create review
    const review = await reviewRepository.create({
      bookingId,
      businessId: booking.business_id,
      customerId,
      rating: input.rating,
      comment: input.comment,
    });

    // 4. Trigger notification to business owner (best-effort)
    try {
      const business = await businessRepository.findById(booking.business_id);
      if (business) {
        await notificationService.create({
          userId: business.owner_id,
          type: NotificationType.REVIEW_RECEIVED,
          title: 'New Review',
          message: `${booking.customer_name} left a ${input.rating}-star review for ${business.name}`,
          metadata: {
            reviewId: review.id,
            bookingId,
            rating: input.rating,
            businessId: business.id,
            businessName: business.name,
            customerName: booking.customer_name,
          },
        });
      }
    } catch {
      logger.warn('Failed to create review notification (non-fatal)');
    }

    return review;
  },

  /**
   * Gets published reviews for a business with pagination and average rating.
   * @param businessId - The business UUID.
   * @param page - Page number.
   * @param limit - Items per page.
   */
  async getByBusinessId(
    businessId: string,
    page: number = Pagination.DEFAULT_PAGE,
    limit: number = Pagination.DEFAULT_LIMIT,
  ) {
    logger.debug('reviewService.getByBusinessId', { businessId, page, limit });

    const result = await reviewRepository.findByBusinessId(businessId, page, limit);
    const ratingInfo = await reviewRepository.getAverageRating(businessId);

    const reviews = result.data.map((r: Record<string, unknown>) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      customer: {
        firstName: r.customer_first_name,
        lastName: r.customer_last_name,
        profileImage: r.customer_profile_image || null,
      },
    }));

    return {
      reviews,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
        averageRating: ratingInfo.average,
        reviewCount: ratingInfo.count,
      },
    };
  },
};
