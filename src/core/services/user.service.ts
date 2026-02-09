import { logger } from '../../libs';

import type { UpdateUserInput } from '../validators';

/**
 * User service — business logic for user profile management.
 */
export const userService = {
  async getProfile(userId: string) {
    // TODO: Implement in Sprint 3
    logger.debug('userService.getProfile', { userId });
    throw new Error('Not implemented');
  },

  async updateProfile(userId: string, input: UpdateUserInput) {
    // TODO: Implement in Sprint 3
    logger.debug('userService.updateProfile', { userId });
    throw new Error('Not implemented');
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
