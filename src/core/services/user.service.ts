import { logger } from '../../libs';
import { AppError } from '../../middleware';
import { HttpStatus } from '../constants';
import { userRepository } from '../repositories';

import type { UpdateUserInput } from '../validators';

/**
 * Strip password hash and map snake_case → camelCase for client consumption.
 */
const sanitizeUser = (row: Record<string, unknown>) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  role: row.role,
  emailVerified: row.email_verified,
  phoneVerified: row.phone_verified,
  profileImage: row.profile_image,
  timezone: row.timezone,
  language: row.language,
  isActive: row.is_active,
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * User service — business logic for user profile management.
 */
export const userService = {
  async getProfile(userId: string) {
    logger.debug('userService.getProfile', { userId });

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
    }

    return sanitizeUser(user);
  },

  async updateProfile(userId: string, input: UpdateUserInput) {
    logger.debug('userService.updateProfile', { userId, fields: Object.keys(input) });

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', HttpStatus.NOT_FOUND, 'USER_NOT_FOUND');
    }

    const updated = await userRepository.update(userId, input);
    return sanitizeUser(updated);
  },

  async getUserById(userId: string) {
    // TODO: Implement in Sprint 8 (admin)
    logger.debug('userService.getUserById', { userId });
    throw new Error('Not implemented');
  },

  async listUsers(page: number, limit: number) {
    // TODO: Implement in Sprint 8 (admin)
    logger.debug('userService.listUsers', { page, limit });
    throw new Error('Not implemented');
  },

  async deleteUser(userId: string) {
    // TODO: Implement in Sprint 8 (admin)
    logger.debug('userService.deleteUser', { userId });
    throw new Error('Not implemented');
  },
};
