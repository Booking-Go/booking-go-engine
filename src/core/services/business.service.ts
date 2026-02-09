import { logger } from '../../libs';

import type { CreateBusinessInput, UpdateBusinessInput, BusinessHoursInput, BusinessHolidayInput } from '../validators';

/**
 * Business service — business logic for business management.
 */
export const businessService = {
  async create(ownerId: string, input: CreateBusinessInput) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.create', { ownerId });
    throw new Error('Not implemented');
  },

  async getById(businessId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.getById', { businessId });
    throw new Error('Not implemented');
  },

  async getBySlug(slug: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.getBySlug', { slug });
    throw new Error('Not implemented');
  },

  async list(filters: Record<string, unknown>, page: number, limit: number) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.list', { filters, page, limit });
    throw new Error('Not implemented');
  },

  async update(businessId: string, ownerId: string, input: UpdateBusinessInput) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.update', { businessId, ownerId });
    throw new Error('Not implemented');
  },

  async delete(businessId: string, ownerId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.delete', { businessId, ownerId });
    throw new Error('Not implemented');
  },

  // --- Business Hours ---

  async getHours(businessId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.getHours', { businessId });
    throw new Error('Not implemented');
  },

  async setHours(businessId: string, ownerId: string, hours: BusinessHoursInput[]) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.setHours', { businessId });
    throw new Error('Not implemented');
  },

  // --- Business Holidays ---

  async getHolidays(businessId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.getHolidays', { businessId });
    throw new Error('Not implemented');
  },

  async addHoliday(businessId: string, ownerId: string, holiday: BusinessHolidayInput) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.addHoliday', { businessId });
    throw new Error('Not implemented');
  },

  async removeHoliday(businessId: string, ownerId: string, holidayId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessService.removeHoliday', { businessId, holidayId });
    throw new Error('Not implemented');
  },
};
