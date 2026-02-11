import { logger, cache } from '../../libs';
import { AppError } from '../../middleware';
import { HttpStatus, UserRole, CacheKeys, CacheTTL } from '../constants';
import { businessRepository } from '../repositories';

import type { CreateBusinessInput, UpdateBusinessInput, BusinessHoursInput, BusinessHolidayInput } from '../validators';

/**
 * Map snake_case DB row → camelCase for client consumption.
 */
const sanitizeBusiness = (row: Record<string, unknown>) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  category: row.category,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  city: row.city,
  state: row.state,
  zipCode: row.zip_code,
  country: row.country,
  latitude: row.latitude,
  longitude: row.longitude,
  phone: row.phone,
  email: row.email,
  website: row.website,
  logoUrl: row.logo_url,
  coverImageUrl: row.cover_image_url,
  primaryColor: row.primary_color,
  settings: row.settings,
  isActive: row.is_active,
  isVerified: row.is_verified,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizeHours = (row: Record<string, unknown>) => ({
  id: row.id,
  businessId: row.business_id,
  dayOfWeek: row.day_of_week,
  openTime: row.open_time,
  closeTime: row.close_time,
  isClosed: row.is_closed,
});

const sanitizeHoliday = (row: Record<string, unknown>) => ({
  id: row.id,
  businessId: row.business_id,
  date: row.holiday_date,
  reason: row.reason,
  createdAt: row.created_at,
});

/**
 * Verify the requesting user owns the business. Throws 403 if not.
 */
const assertOwnership = async (businessId: string, ownerId: string) => {
  const business = await businessRepository.findById(businessId);
  if (!business) {
    throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
  }
  if (business.owner_id !== ownerId) {
    throw new AppError('You do not own this business', HttpStatus.FORBIDDEN, 'NOT_BUSINESS_OWNER');
  }
  return business;
};

/**
 * Business service — business logic for business management.
 */
export const businessService = {
  async create(ownerId: string, input: CreateBusinessInput) {
    logger.debug('businessService.create', { ownerId, name: input.name });

    // Check slug uniqueness
    const existing = await businessRepository.findBySlug(input.slug);
    if (existing) {
      throw new AppError('A business with this slug already exists', HttpStatus.CONFLICT, 'SLUG_TAKEN');
    }

    const business = await businessRepository.create({
      ownerId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      zipCode: input.zipCode,
      country: input.country,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      email: input.email,
      website: input.website,
      logoUrl: input.logoUrl,
      coverImageUrl: input.coverImageUrl,
      settings: input.settings,
    });

    return sanitizeBusiness(business);
  },

  async getById(businessId: string) {
    logger.debug('businessService.getById', { businessId });

    // Try cache first
    const cacheKey = CacheKeys.businessProfile(businessId);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
    }

    const result = sanitizeBusiness(business);
    await cache.set(cacheKey, result, CacheTTL.BUSINESS_PROFILE);
    return result;
  },

  async getBySlug(slug: string) {
    logger.debug('businessService.getBySlug', { slug });

    const business = await businessRepository.findBySlug(slug);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
    }

    return sanitizeBusiness(business);
  },

  async list(filters: Record<string, unknown>, page: number, limit: number) {
    logger.debug('businessService.list', { filters, page, limit });

    const result = await businessRepository.findAll(filters, page, limit);
    return {
      businesses: result.data.map(sanitizeBusiness),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  },

  async getMyBusinesses(ownerId: string) {
    logger.debug('businessService.getMyBusinesses', { ownerId });
    const businesses = await businessRepository.findByOwnerId(ownerId);
    return businesses.map(sanitizeBusiness);
  },

  async update(businessId: string, ownerId: string, input: UpdateBusinessInput) {
    logger.debug('businessService.update', { businessId, ownerId });

    await assertOwnership(businessId, ownerId);

    // If slug is being changed, check uniqueness
    if (input.slug) {
      const existing = await businessRepository.findBySlug(input.slug);
      if (existing && existing.id !== businessId) {
        throw new AppError('A business with this slug already exists', HttpStatus.CONFLICT, 'SLUG_TAKEN');
      }
    }

    const updated = await businessRepository.update(businessId, input);
    if (!updated) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
    }

    // Invalidate cache
    await cache.del(CacheKeys.businessProfile(businessId));

    return sanitizeBusiness(updated);
  },

  async delete(businessId: string, ownerId: string) {
    logger.debug('businessService.delete', { businessId, ownerId });

    await assertOwnership(businessId, ownerId);

    const deleted = await businessRepository.delete(businessId);
    if (!deleted) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
    }

    // Invalidate all cache for this business
    await cache.invalidatePattern(`business:${businessId}:*`);
  },

  // --- Business Hours ---

  async getHours(businessId: string) {
    logger.debug('businessService.getHours', { businessId });

    // Verify business exists
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
    }

    const hours = await businessRepository.getBusinessHours(businessId);
    return hours.map(sanitizeHours);
  },

  async setHours(businessId: string, ownerId: string, hours: BusinessHoursInput[]) {
    logger.debug('businessService.setHours', { businessId, count: hours.length });

    await assertOwnership(businessId, ownerId);

    const result = await businessRepository.setBusinessHours(businessId, hours);

    // Invalidate slot availability cache
    await cache.invalidatePattern(`business:${businessId}:slots:*`);

    return result.map(sanitizeHours);
  },

  // --- Business Holidays ---

  async getHolidays(businessId: string) {
    logger.debug('businessService.getHolidays', { businessId });

    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND, 'BUSINESS_NOT_FOUND');
    }

    const holidays = await businessRepository.getBusinessHolidays(businessId);
    return holidays.map(sanitizeHoliday);
  },

  async addHoliday(businessId: string, ownerId: string, holiday: BusinessHolidayInput) {
    logger.debug('businessService.addHoliday', { businessId, date: holiday.date });

    await assertOwnership(businessId, ownerId);

    try {
      const result = await businessRepository.addBusinessHoliday(businessId, holiday);
      await cache.invalidatePattern(`business:${businessId}:slots:*`);
      return sanitizeHoliday(result);
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('unique')) {
        throw new AppError('Holiday already exists for this date', HttpStatus.CONFLICT, 'HOLIDAY_EXISTS');
      }
      throw error;
    }
  },

  async removeHoliday(businessId: string, ownerId: string, holidayId: string) {
    logger.debug('businessService.removeHoliday', { businessId, holidayId });

    await assertOwnership(businessId, ownerId);

    const removed = await businessRepository.removeBusinessHoliday(businessId, holidayId);
    if (!removed) {
      throw new AppError('Holiday not found', HttpStatus.NOT_FOUND, 'HOLIDAY_NOT_FOUND');
    }

    await cache.invalidatePattern(`business:${businessId}:slots:*`);
  },
};
