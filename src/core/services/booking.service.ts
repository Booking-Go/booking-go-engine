import { logger, cache } from '../../libs';
import { pgPool } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, BookingStatus, CacheKeys } from '../constants';
import { bookingRepository } from '../repositories/booking.repository';
import { slotRepository } from '../repositories/slot.repository';
import { businessRepository } from '../repositories/business.repository';
import { userRepository } from '../repositories/user.repository';
import { notificationService } from './notification.service';
import { NotificationType } from '../constants';

import type { CreateBookingInput, UpdateBookingInput, CancelBookingInput } from '../validators';

/**
 * Booking service — business logic for the booking lifecycle.
 * State machine: pending → confirmed → completed
 *                pending → cancelled
 *                confirmed → cancelled
 *                confirmed → completed
 *                confirmed → no_show
 */
export const bookingService = {
  /**
   * Creates a new booking within a database transaction (slot lock + capacity check).
   * @param customerId - The ID of the customer creating the booking.
   * @param input - Validated booking input (slotId, numberOfPeople, notes).
   * @returns The formatted booking record.
   */
  async create(customerId: string, input: CreateBookingInput) {
    logger.debug('bookingService.create', { customerId, slotId: input.slotId });

    // 1. Fetch customer profile for booking record
    const customer = await userRepository.findById(customerId);
    if (!customer) throw new AppError('Customer not found', HttpStatus.NOT_FOUND);

    // 2. Start PG transaction — lock slot row to prevent double booking
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // 3. SELECT FOR UPDATE — lock the slot
      const slot = await slotRepository.findByIdForUpdate(input.slotId, client);
      if (!slot) {
        await client.query('ROLLBACK');
        throw new AppError('Slot not found', HttpStatus.NOT_FOUND);
      }

      // 4. Verify slot is bookable
      if (!slot.is_available) {
        await client.query('ROLLBACK');
        throw new AppError('This slot is no longer available', HttpStatus.CONFLICT);
      }

      const requestedPeople = input.numberOfPeople ?? 1;
      if (slot.booked_count + requestedPeople > slot.capacity) {
        await client.query('ROLLBACK');
        throw new AppError(
          `Not enough capacity. Available: ${slot.capacity - slot.booked_count}, Requested: ${requestedPeople}`,
          HttpStatus.CONFLICT,
        );
      }

      // Check slot isn't in the past
      if (new Date(slot.start_time) <= new Date()) {
        await client.query('ROLLBACK');
        throw new AppError('Cannot book a slot in the past', HttpStatus.BAD_REQUEST);
      }

      // 5. Create booking record
      const totalPrice = parseFloat(slot.price) * requestedPeople;
      const bookingDate = new Date(slot.start_time).toISOString().split('T')[0];

      const booking = await bookingRepository.create(
        {
          slotId: slot.id,
          businessId: slot.business_id,
          customerId,
          serviceId: slot.service_id || undefined,
          bookingDate,
          startTime: slot.start_time,
          endTime: slot.end_time,
          numberOfPeople: requestedPeople,
          totalPrice,
          customerName: `${customer.first_name} ${customer.last_name}`,
          customerEmail: customer.email,
          customerPhone: customer.phone || undefined,
          notes: input.notes,
        },
        client,
      );

      // 6. Update slot booked count
      const updatedSlot = await slotRepository.incrementBookedCount(
        slot.id,
        requestedPeople,
        client,
      );
      if (!updatedSlot) {
        await client.query('ROLLBACK');
        throw new AppError('Slot is no longer available (concurrent booking)', HttpStatus.CONFLICT);
      }

      // 7. Commit
      await client.query('COMMIT');

      // 8. Invalidate slot cache
      const slotDate = new Date(slot.start_time).toISOString().split('T')[0];
      await cache.del(CacheKeys.slotAvailability(slot.business_id, slotDate));

      // 9. Trigger notification (best-effort — don't break booking on notification failure)
      try {
        const business = await businessRepository.findById(slot.business_id);
        if (business) {
          await notificationService.create({
            userId: business.owner_id,
            type: NotificationType.BOOKING_CREATED,
            title: 'New Booking',
            message: `${customer.first_name} ${customer.last_name} booked a slot on ${bookingDate}`,
            metadata: { bookingId: booking.id, slotId: slot.id },
          });
        }
      } catch {
        logger.warn('Failed to create booking notification (non-fatal)');
      }

      return this.formatBooking(booking);
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Retrieves a booking by ID with access-control checks.
   * @param bookingId - The booking UUID.
   * @param requesterId - ID of the user requesting the booking.
   * @param requesterRole - Role of the requesting user.
   */
  async getById(bookingId: string, requesterId: string, requesterRole: string) {
    logger.debug('bookingService.getById', { bookingId, requesterId });

    const booking = await bookingRepository.findByIdWithDetails(bookingId);
    if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND);

    // Access control: customer sees own, owner sees own business bookings, admin sees all
    if (requesterRole !== 'admin') {
      if (booking.customer_id !== requesterId) {
        // Check if requester is the business owner
        const business = await businessRepository.findById(booking.business_id);
        if (!business || business.owner_id !== requesterId) {
          throw new AppError('Not authorized to view this booking', HttpStatus.FORBIDDEN);
        }
      }
    }

    return this.formatBooking(booking);
  },

  /**
   * Lists bookings for a user with pagination and optional status/date filters.
   * @param userId - The user ID.
   * @param role - The user's role (customer, business_owner, admin).
   * @param page - Page number.
   * @param limit - Items per page.
   * @param filters - Optional status, startDate, endDate filters.
   */
  async listForUser(
    userId: string,
    role: string,
    page: number,
    limit: number,
    filters?: { status?: string; startDate?: string; endDate?: string },
  ) {
    logger.debug('bookingService.listForUser', { userId, role, page, limit });

    let result;
    if (role === 'customer') {
      result = await bookingRepository.findByUserId(userId, page, limit, filters);
    } else if (role === 'business_owner') {
      result = await bookingRepository.findByOwnerId(userId, page, limit, filters);
    } else {
      // Admin — could list all, but we scope to what makes sense
      result = await bookingRepository.findByUserId(userId, page, limit, filters);
    }

    const totalPages = Math.ceil(result.total / limit);

    return {
      bookings: result.data.map(this.formatBooking),
      meta: { page: result.page, limit: result.limit, total: result.total, totalPages },
    };
  },

  /**
   * Confirms a pending booking. Only the business owner can confirm.
   * @param bookingId - The booking UUID.
   * @param ownerId - The business owner's user ID.
   */
  async confirm(bookingId: string, ownerId: string) {
    logger.debug('bookingService.confirm', { bookingId, ownerId });

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND);

    // Verify ownership
    const business = await businessRepository.findById(booking.business_id);
    if (!business || business.owner_id !== ownerId) {
      throw new AppError('Not authorized to confirm this booking', HttpStatus.FORBIDDEN);
    }

    if (booking.status !== BookingStatus.PENDING) {
      throw new AppError(
        `Cannot confirm a booking with status "${booking.status}"`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await bookingRepository.updateStatus(bookingId, BookingStatus.CONFIRMED);

    // Notify customer
    try {
      await notificationService.create({
        userId: booking.customer_id,
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Booking Confirmed',
        message: `Your booking at ${business.name} has been confirmed.`,
        metadata: { bookingId },
      });
    } catch {
      logger.warn('Failed to send confirmation notification (non-fatal)');
    }

    return this.formatBooking(updated);
  },

  /**
   * Cancels a booking — releases slot capacity and notifies the other party.
   * @param bookingId - The booking UUID.
   * @param requesterId - ID of the user requesting cancellation.
   * @param requesterRole - Role of the requesting user.
   * @param input - Validated cancellation input (reason).
   */
  async cancel(
    bookingId: string,
    requesterId: string,
    requesterRole: string,
    input: CancelBookingInput,
  ) {
    logger.debug('bookingService.cancel', { bookingId, requesterId });

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND);

    // Determine who is cancelling
    let cancelledBy: string;
    if (booking.customer_id === requesterId) {
      cancelledBy = 'customer';
    } else {
      const business = await businessRepository.findById(booking.business_id);
      if (business && business.owner_id === requesterId) {
        cancelledBy = 'business';
      } else if (requesterRole === 'admin') {
        cancelledBy = 'system';
      } else {
        throw new AppError('Not authorized to cancel this booking', HttpStatus.FORBIDDEN);
      }
    }

    // Validate status transition
    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError('Booking is already cancelled', HttpStatus.BAD_REQUEST);
    }
    if (booking.status === BookingStatus.COMPLETED) {
      throw new AppError('Cannot cancel a completed booking', HttpStatus.BAD_REQUEST);
    }

    // Update booking
    const updated = await bookingRepository.updateStatus(bookingId, BookingStatus.CANCELLED, {
      cancelledBy,
      cancellationReason: input.reason,
    });

    // Release slot capacity
    await slotRepository.decrementBookedCount(booking.slot_id, booking.number_of_people || 1);

    // Invalidate slot cache
    const slotDate = new Date(booking.start_time).toISOString().split('T')[0];
    await cache.del(CacheKeys.slotAvailability(booking.business_id, slotDate));

    // Notify
    try {
      const notifyUserId = cancelledBy === 'customer' ? booking.business_id : booking.customer_id;
      await notificationService.create({
        userId: notifyUserId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Booking Cancelled',
        message: `A booking has been cancelled${input.reason ? `: ${input.reason}` : ''}.`,
        metadata: { bookingId, cancelledBy },
      });
    } catch {
      logger.warn('Failed to send cancellation notification (non-fatal)');
    }

    return this.formatBooking(updated);
  },

  /**
   * Marks a confirmed booking as completed. Only the business owner can complete.
   * @param bookingId - The booking UUID.
   * @param ownerId - The business owner's user ID.
   */
  async complete(bookingId: string, ownerId: string) {
    logger.debug('bookingService.complete', { bookingId, ownerId });

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND);

    // Verify ownership
    const business = await businessRepository.findById(booking.business_id);
    if (!business || business.owner_id !== ownerId) {
      throw new AppError('Not authorized to complete this booking', HttpStatus.FORBIDDEN);
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new AppError(
        `Cannot complete a booking with status "${booking.status}". Must be confirmed first.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await bookingRepository.updateStatus(bookingId, BookingStatus.COMPLETED);

    // Notify customer
    try {
      await notificationService.create({
        userId: booking.customer_id,
        type: NotificationType.BOOKING_COMPLETED,
        title: 'Booking Completed',
        message: `Your booking at ${business.name} has been completed. How was your experience?`,
        metadata: { bookingId },
      });
    } catch {
      logger.warn('Failed to send completion notification (non-fatal)');
    }

    return this.formatBooking(updated);
  },

  /**
   * Updates a booking's notes. Only the customer can update, and only if pending/confirmed.
   * @param bookingId - The booking UUID.
   * @param requesterId - The customer's user ID.
   * @param input - Validated update input.
   */
  async update(bookingId: string, requesterId: string, input: UpdateBookingInput) {
    logger.debug('bookingService.update', { bookingId, requesterId });

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', HttpStatus.NOT_FOUND);

    // Only the customer can update notes, and only if pending/confirmed
    if (booking.customer_id !== requesterId) {
      throw new AppError('Not authorized to update this booking', HttpStatus.FORBIDDEN);
    }

    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
      throw new AppError(`Cannot update a ${booking.status} booking`, HttpStatus.BAD_REQUEST);
    }

    const updated = await bookingRepository.update(bookingId, input);
    return this.formatBooking(updated);
  },

  /** Map snake_case DB row → camelCase API response */
  formatBooking(row: Record<string, unknown>) {
    return {
      id: row.id,
      slotId: row.slot_id,
      businessId: row.business_id,
      customerId: row.customer_id,
      serviceId: row.service_id || null,
      status: row.status,
      bookingDate: row.booking_date,
      startTime: row.start_time,
      endTime: row.end_time,
      numberOfPeople: row.number_of_people,
      totalPrice: parseFloat(row.total_price as string),
      depositPaid: parseFloat((row.deposit_paid as string) || '0'),
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone || null,
      notes: row.notes || null,
      cancellationReason: row.cancellation_reason || null,
      cancelledBy: row.cancelled_by || null,
      cancelledAt: row.cancelled_at || null,
      confirmedAt: row.confirmed_at || null,
      completedAt: row.completed_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined fields (when available)
      ...(row.business_name
        ? {
            business: {
              id: row.business_id,
              name: row.business_name,
              slug: row.business_slug,
            },
          }
        : {}),
      ...(row.service_name
        ? {
            service: {
              id: row.service_id,
              name: row.service_name,
              duration: row.service_duration,
            },
          }
        : {}),
      ...(row.customer_first_name
        ? {
            customer: {
              firstName: row.customer_first_name,
              lastName: row.customer_last_name,
            },
          }
        : {}),
    };
  },
};
