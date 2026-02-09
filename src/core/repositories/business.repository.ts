import { logger } from '../../libs';

/**
 * Business repository — PostgreSQL data access for the businesses table.
 */
export const businessRepository = {
  async findById(id: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.findById', { id });
    throw new Error('Not implemented');
  },

  async findBySlug(slug: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.findBySlug', { slug });
    throw new Error('Not implemented');
  },

  async findByOwnerId(ownerId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.findByOwnerId', { ownerId });
    throw new Error('Not implemented');
  },

  async findAll(filters: Record<string, unknown>, page: number, limit: number) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.findAll', { filters, page, limit });
    throw new Error('Not implemented');
  },

  async create(data: Record<string, unknown>) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.create');
    throw new Error('Not implemented');
  },

  async update(id: string, data: Record<string, unknown>) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.update', { id });
    throw new Error('Not implemented');
  },

  async delete(id: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.delete', { id });
    throw new Error('Not implemented');
  },

  // --- Business Hours ---

  async getBusinessHours(businessId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.getBusinessHours', { businessId });
    throw new Error('Not implemented');
  },

  async setBusinessHours(businessId: string, hours: unknown[]) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.setBusinessHours', { businessId });
    throw new Error('Not implemented');
  },

  // --- Business Holidays ---

  async getBusinessHolidays(businessId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.getBusinessHolidays', { businessId });
    throw new Error('Not implemented');
  },

  async addBusinessHoliday(businessId: string, holiday: unknown) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.addBusinessHoliday', { businessId });
    throw new Error('Not implemented');
  },

  async removeBusinessHoliday(businessId: string, holidayId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('businessRepository.removeBusinessHoliday', { businessId, holidayId });
    throw new Error('Not implemented');
  },
};
