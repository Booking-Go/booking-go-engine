import { logger } from '../../libs';

import { NotificationType } from '../constants';

/**
 * Notification service — creates and queries in-app notifications (MongoDB).
 */
export const notificationService = {
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    // TODO: Implement in Sprint 7
    logger.debug('notificationService.create', { userId: data.userId, type: data.type });
    throw new Error('Not implemented');
  },

  async getForUser(userId: string, page: number, limit: number) {
    // TODO: Implement in Sprint 7
    logger.debug('notificationService.getForUser', { userId, page, limit });
    throw new Error('Not implemented');
  },

  async markAsRead(notificationId: string, userId: string) {
    // TODO: Implement in Sprint 7
    logger.debug('notificationService.markAsRead', { notificationId, userId });
    throw new Error('Not implemented');
  },

  async getUnreadCount(userId: string): Promise<number> {
    // TODO: Implement in Sprint 7
    logger.debug('notificationService.getUnreadCount', { userId });
    throw new Error('Not implemented');
  },
};
