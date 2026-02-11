import { logger, cache } from '../../libs';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, CacheKeys, CacheTTL, AppConfig, Pagination } from '../constants';
import { slotRepository } from '../repositories/slot.repository';
import { businessRepository } from '../repositories/business.repository';
import { serviceRepository } from '../repositories/service.repository';

import type { CreateSlotInput, BulkCreateSlotsInput, UpdateSlotInput, AvailableSlotsQuery } from '../validators';

/**
 * Slot service — business logic for slot management.
 */
export const slotService = {
  async create(ownerId: string, input: CreateSlotInput) {
    logger.debug('slotService.create', { ownerId });

    // Verify business exists and caller is the owner
    const business = await businessRepository.findById(input.businessId);
    if (!business) throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    if (business.owner_id !== ownerId) throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);

    // Verify service belongs to this business
    const service = await serviceRepository.findById(input.serviceId);
    if (!service || service.business_id !== input.businessId) {
      throw new AppError('Service not found in this business', HttpStatus.NOT_FOUND);
    }

    // Validate time range
    if (new Date(input.endTime) <= new Date(input.startTime)) {
      throw new AppError('End time must be after start time', HttpStatus.BAD_REQUEST);
    }

    const slot = await slotRepository.create({
      businessId: input.businessId,
      serviceId: input.serviceId,
      startTime: input.startTime,
      endTime: input.endTime,
      capacity: input.capacity,
      price: input.price,
      notes: input.notes,
    });

    // Invalidate cache for the slot date
    const slotDate = new Date(input.startTime).toISOString().split('T')[0];
    await cache.del(CacheKeys.slotAvailability(input.businessId, slotDate));

    return this.formatSlot(slot);
  },

  async bulkCreate(ownerId: string, input: BulkCreateSlotsInput) {
    logger.debug('slotService.bulkCreate', { ownerId });

    // Verify business + ownership
    const business = await businessRepository.findById(input.businessId);
    if (!business) throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    if (business.owner_id !== ownerId) throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);

    // Verify service
    const service = await serviceRepository.findById(input.serviceId);
    if (!service || service.business_id !== input.businessId) {
      throw new AppError('Service not found in this business', HttpStatus.NOT_FOUND);
    }

    // Fetch business hours and holidays
    const businessHours = await businessRepository.getBusinessHours(input.businessId);
    const holidays = await businessRepository.getBusinessHolidays(input.businessId);
    const holidayDates = new Set(
      holidays.map((h: Record<string, unknown>) => {
        const d = new Date(h.holiday_date as string);
        return d.toISOString().split('T')[0];
      }),
    );

    // Build a map of day_of_week → business hours
    const hoursMap = new Map<number, { openTime: string; closeTime: string }>();
    for (const h of businessHours) {
      if (!h.is_closed) {
        hoursMap.set(h.day_of_week, {
          openTime: h.open_time,
          closeTime: h.close_time,
        });
      }
    }

    // Generate slot entries
    const slots: {
      businessId: string;
      serviceId: string;
      startTime: string;
      endTime: string;
      capacity: number;
      price: number;
    }[] = [];

    const startDate = new Date(input.startDate + 'T00:00:00');
    const endDate = new Date(input.endDate + 'T00:00:00');
    const serviceDuration = service.duration as number; // in minutes

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      // Skip holidays
      if (holidayDates.has(dateStr)) continue;

      // JavaScript getDay(): 0=Sun, 1=Mon, ... 6=Sat → convert to our DayOfWeek: 0=Mon..6=Sun
      const jsDay = d.getDay();
      const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

      // Skip if this day isn't in the requested daysOfWeek filter
      if (input.daysOfWeek && !input.daysOfWeek.includes(dayOfWeek)) continue;

      if (input.timeSlots && input.timeSlots.length > 0) {
        // Use explicit time windows provided by the user
        for (const ts of input.timeSlots) {
          const startTime = `${dateStr}T${ts.startTime}:00`;
          const endTime = `${dateStr}T${ts.endTime}:00`;
          slots.push({
            businessId: input.businessId,
            serviceId: input.serviceId,
            startTime,
            endTime,
            capacity: input.capacity,
            price: input.price,
          });
        }
      } else {
        // Auto-generate from business hours + service duration
        const hours = hoursMap.get(dayOfWeek);
        if (!hours) continue; // Business is closed on this day

        // Parse open/close times (HH:mm or HH:mm:ss format)
        const [openH, openM] = hours.openTime.split(':').map(Number);
        const [closeH, closeM] = hours.closeTime.split(':').map(Number);

        let currentMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        while (currentMinutes + serviceDuration <= closeMinutes) {
          const startH = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
          const startM = String(currentMinutes % 60).padStart(2, '0');
          const endMin = currentMinutes + serviceDuration;
          const endH = String(Math.floor(endMin / 60)).padStart(2, '0');
          const endMStr = String(endMin % 60).padStart(2, '0');

          slots.push({
            businessId: input.businessId,
            serviceId: input.serviceId,
            startTime: `${dateStr}T${startH}:${startM}:00`,
            endTime: `${dateStr}T${endH}:${endMStr}:00`,
            capacity: input.capacity,
            price: input.price,
          });

          // Advance by service duration + buffer time
          const bufferTime = (service.buffer_time as number) || 0;
          currentMinutes += serviceDuration + bufferTime;
        }
      }
    }

    if (slots.length === 0) {
      throw new AppError('No slots could be generated for the given date range and business hours', HttpStatus.BAD_REQUEST);
    }

    if (slots.length > AppConfig.MAX_SLOTS_BULK_CREATE) {
      throw new AppError(
        `Cannot create more than ${AppConfig.MAX_SLOTS_BULK_CREATE} slots at once. Requested: ${slots.length}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const created = await slotRepository.bulkCreate(slots);

    // Invalidate cache for all affected dates
    const affectedDates = new Set(slots.map((s) => s.startTime.split('T')[0]));
    const invalidatePromises = Array.from(affectedDates).map((date) =>
      cache.del(CacheKeys.slotAvailability(input.businessId, date)),
    );
    await Promise.all(invalidatePromises);

    return { created: created.length, slots: created.map(this.formatSlot) };
  },

  async getAvailable(query: AvailableSlotsQuery) {
    logger.debug('slotService.getAvailable', { query });

    // Verify business exists
    const business = await businessRepository.findById(query.businessId);
    if (!business) throw new AppError('Business not found', HttpStatus.NOT_FOUND);

    // Try cache for single-date queries
    const cacheDate = query.date || query.startDate;
    if (cacheDate && !query.endDate) {
      const cached = await cache.get<ReturnType<typeof this.formatSlot>[]>(
        CacheKeys.slotAvailability(query.businessId, cacheDate),
      );
      if (cached) return cached;
    }

    const rows = await slotRepository.findAvailable({
      businessId: query.businessId,
      serviceId: query.serviceId,
      date: query.date,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    const slots = rows.map(this.formatSlot);

    // Cache single-date results
    if (cacheDate && !query.endDate) {
      await cache.set(
        CacheKeys.slotAvailability(query.businessId, cacheDate),
        slots,
        CacheTTL.SLOT_AVAILABILITY,
      );
    }

    return slots;
  },

  async getById(slotId: string) {
    logger.debug('slotService.getById', { slotId });

    const row = await slotRepository.findByIdWithService(slotId);
    if (!row) throw new AppError('Slot not found', HttpStatus.NOT_FOUND);

    return this.formatSlot(row);
  },

  async list(
    businessId: string,
    ownerId: string,
    page: number,
    limit: number,
    filters?: { serviceId?: string; date?: string; isAvailable?: boolean },
  ) {
    logger.debug('slotService.list', { businessId, ownerId, page, limit });

    // Verify ownership
    const business = await businessRepository.findById(businessId);
    if (!business) throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    if (business.owner_id !== ownerId) throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);

    const result = await slotRepository.findByBusinessId(businessId, page, limit, filters);
    const totalPages = Math.ceil(result.total / limit);

    return {
      slots: result.data.map(this.formatSlot),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
      },
    };
  },

  async update(slotId: string, ownerId: string, input: UpdateSlotInput) {
    logger.debug('slotService.update', { slotId, ownerId });

    const existing = await slotRepository.findById(slotId);
    if (!existing) throw new AppError('Slot not found', HttpStatus.NOT_FOUND);

    // Verify ownership
    const business = await businessRepository.findById(existing.business_id);
    if (!business || business.owner_id !== ownerId) {
      throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);
    }

    // Cannot modify a fully-booked slot's time
    if (existing.booked_count > 0 && (input.startTime || input.endTime)) {
      throw new AppError('Cannot change time of a slot with existing bookings', HttpStatus.BAD_REQUEST);
    }

    // Cannot reduce capacity below booked count
    if (input.capacity !== undefined && input.capacity < existing.booked_count) {
      throw new AppError(
        `Cannot reduce capacity below current bookings (${existing.booked_count})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await slotRepository.update(slotId, input);
    if (!updated) throw new AppError('Slot not found', HttpStatus.NOT_FOUND);

    // Invalidate cache
    const slotDate = new Date(existing.start_time).toISOString().split('T')[0];
    await cache.del(CacheKeys.slotAvailability(existing.business_id, slotDate));

    return this.formatSlot(updated);
  },

  async delete(slotId: string, ownerId: string) {
    logger.debug('slotService.delete', { slotId, ownerId });

    const existing = await slotRepository.findById(slotId);
    if (!existing) throw new AppError('Slot not found', HttpStatus.NOT_FOUND);

    // Verify ownership
    const business = await businessRepository.findById(existing.business_id);
    if (!business || business.owner_id !== ownerId) {
      throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);
    }

    // Cannot delete a slot with active bookings
    if (existing.booked_count > 0) {
      throw new AppError('Cannot delete a slot with existing bookings. Cancel bookings first.', HttpStatus.BAD_REQUEST);
    }

    const deleted = await slotRepository.delete(slotId);
    if (!deleted) throw new AppError('Slot not found', HttpStatus.NOT_FOUND);

    // Invalidate cache
    const slotDate = new Date(existing.start_time).toISOString().split('T')[0];
    await cache.del(CacheKeys.slotAvailability(existing.business_id, slotDate));
  },

  /** Map snake_case DB row → camelCase API response */
  formatSlot(row: Record<string, unknown>) {
    return {
      id: row.id,
      businessId: row.business_id,
      serviceId: row.service_id,
      startTime: row.start_time,
      endTime: row.end_time,
      capacity: row.capacity,
      bookedCount: row.booked_count,
      isAvailable: row.is_available,
      price: parseFloat(row.price as string),
      recurrencePattern: row.recurrence_pattern || null,
      recurrenceEndDate: row.recurrence_end_date || null,
      parentSlotId: row.parent_slot_id || null,
      notes: row.notes || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Joined service fields (when available)
      ...(row.service_name
        ? {
            service: {
              id: row.service_id,
              name: row.service_name,
              duration: row.service_duration,
            },
          }
        : {}),
    };
  },
};
