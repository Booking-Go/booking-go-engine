import { logger, cache } from '../../libs';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, CacheKeys, CacheTTL } from '../constants';
import { serviceRepository } from '../repositories/service.repository';
import { businessRepository } from '../repositories/business.repository';

import type { CreateServiceInput, UpdateServiceInput } from '../validators';

/**
 * Service service — business logic for service catalog management.
 * (Named "serviceService" to differentiate from the domain entity "Service")
 */
export const serviceService = {
  async create(businessId: string, ownerId: string, input: CreateServiceInput) {
    logger.debug('serviceService.create', { businessId, ownerId });

    // Verify business exists and caller is the owner
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    }
    if (business.owner_id !== ownerId) {
      throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);
    }

    const service = await serviceRepository.create({
      businessId,
      name: input.name,
      description: input.description,
      duration: input.duration,
      price: input.price,
      depositAmount: input.depositAmount,
      maxCapacity: input.maxCapacity,
      bufferTime: input.bufferTime,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
    });

    // Invalidate cache
    await cache.del(CacheKeys.businessServices(businessId));

    return this.formatService(service);
  },

  async getByBusinessId(businessId: string) {
    logger.debug('serviceService.getByBusinessId', { businessId });

    // Try cache first
    const cached = await cache.get<ReturnType<typeof this.formatService>[]>(CacheKeys.businessServices(businessId));
    if (cached) return cached;

    // Verify business exists
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    }

    const rows = await serviceRepository.findByBusinessId(businessId);
    const services = rows.map(this.formatService);

    await cache.set(CacheKeys.businessServices(businessId), services, CacheTTL.BUSINESS_SERVICES);

    return services;
  },

  async getById(serviceId: string) {
    logger.debug('serviceService.getById', { serviceId });

    const row = await serviceRepository.findById(serviceId);
    if (!row) {
      throw new AppError('Service not found', HttpStatus.NOT_FOUND);
    }

    return this.formatService(row);
  },

  async update(serviceId: string, ownerId: string, input: UpdateServiceInput) {
    logger.debug('serviceService.update', { serviceId, ownerId });

    const existing = await serviceRepository.findById(serviceId);
    if (!existing) {
      throw new AppError('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify ownership
    const business = await businessRepository.findById(existing.business_id);
    if (!business || business.owner_id !== ownerId) {
      throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);
    }

    const updated = await serviceRepository.update(serviceId, input);
    if (!updated) {
      throw new AppError('Service not found', HttpStatus.NOT_FOUND);
    }

    // Invalidate cache
    await cache.del(CacheKeys.businessServices(existing.business_id));

    return this.formatService(updated);
  },

  async delete(serviceId: string, ownerId: string) {
    logger.debug('serviceService.delete', { serviceId, ownerId });

    const existing = await serviceRepository.findById(serviceId);
    if (!existing) {
      throw new AppError('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify ownership
    const business = await businessRepository.findById(existing.business_id);
    if (!business || business.owner_id !== ownerId) {
      throw new AppError('You are not the owner of this business', HttpStatus.FORBIDDEN);
    }

    const deleted = await serviceRepository.delete(serviceId);
    if (!deleted) {
      throw new AppError('Service not found', HttpStatus.NOT_FOUND);
    }

    // Invalidate cache
    await cache.del(CacheKeys.businessServices(existing.business_id));
  },

  /** Map snake_case DB row → camelCase API response */
  formatService(row: Record<string, unknown>) {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      description: row.description || null,
      duration: row.duration,
      price: parseFloat(row.price as string),
      depositAmount: parseFloat((row.deposit_amount as string) || '0'),
      maxCapacity: row.max_capacity,
      bufferTime: row.buffer_time,
      imageUrl: row.image_url || null,
      displayOrder: row.display_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};
