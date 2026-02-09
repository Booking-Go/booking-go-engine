import { logger } from '../../libs';

/**
 * Service repository — PostgreSQL data access for the services table.
 */
export const serviceRepository = {
  async findById(id: string) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceRepository.findById', { id });
    throw new Error('Not implemented');
  },

  async findByBusinessId(businessId: string) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceRepository.findByBusinessId', { businessId });
    throw new Error('Not implemented');
  },

  async create(data: Record<string, unknown>) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceRepository.create');
    throw new Error('Not implemented');
  },

  async update(id: string, data: Record<string, unknown>) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceRepository.update', { id });
    throw new Error('Not implemented');
  },

  async delete(id: string) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceRepository.delete', { id });
    throw new Error('Not implemented');
  },
};
