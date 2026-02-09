import { logger } from '../../libs';

import type { CreateServiceInput, UpdateServiceInput } from '../validators';

/**
 * Service service — business logic for service catalog management.
 * (Named "serviceService" to differentiate from the domain entity "Service")
 */
export const serviceService = {
  async create(businessId: string, ownerId: string, input: CreateServiceInput) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceService.create', { businessId });
    throw new Error('Not implemented');
  },

  async getByBusinessId(businessId: string) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceService.getByBusinessId', { businessId });
    throw new Error('Not implemented');
  },

  async getById(serviceId: string) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceService.getById', { serviceId });
    throw new Error('Not implemented');
  },

  async update(serviceId: string, ownerId: string, input: UpdateServiceInput) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceService.update', { serviceId });
    throw new Error('Not implemented');
  },

  async delete(serviceId: string, ownerId: string) {
    // TODO: Implement in Sprint 4
    logger.debug('serviceService.delete', { serviceId });
    throw new Error('Not implemented');
  },
};
