import { logger } from '../../libs';
import { AppError } from '../../middleware';
import { HttpStatus, NotificationType, Pagination } from '../constants';
import { Notification } from '../../models';
import { pushService } from './push.service';

/**
 * Notification service — creates in-app notifications (MongoDB) and
 * dispatches push notifications via FCM.
 */
export const notificationService = {
  /**
   * Creates a new notification document and sends a push notification.
   * @param data - Notification payload.
   * @returns The created notification document.
   */
  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    logger.debug('notificationService.create', { userId: data.userId, type: data.type });

    const notification = await Notification.create({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.metadata,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Send push notification (best-effort, non-blocking)
    pushService
      .sendToUser(data.userId, {
        title: data.title,
        body: data.message,
        data: {
          type: data.type,
          notificationId: notification._id?.toString() ?? '',
          ...(data.metadata
            ? Object.fromEntries(Object.entries(data.metadata).map(([k, v]) => [k, String(v)]))
            : {}),
        },
      })
      .then(() => {
        Notification.findByIdAndUpdate(notification._id, {
          'channels.push': { sent: true, sentAt: new Date() },
        }).catch(() => {});
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.warn(`Push notification failed (non-fatal): ${msg}`);
        Notification.findByIdAndUpdate(notification._id, {
          'channels.push': { sent: false, error: msg },
        }).catch(() => {});
      });

    return notification;
  },

  /**
   * Retrieves paginated notifications for a user.
   * @param userId - The user's UUID.
   * @param page - Page number.
   * @param limit - Items per page.
   * @param unreadOnly - If true, only return unread notifications.
   */
  async getForUser(
    userId: string,
    page: number = Pagination.DEFAULT_PAGE,
    limit: number = Pagination.DEFAULT_LIMIT,
    unreadOnly = false,
  ) {
    logger.debug('notificationService.getForUser', { userId, page, limit, unreadOnly });

    const filter: Record<string, unknown> = { userId };
    if (unreadOnly) {
      filter.isRead = false;
    }

    const total = await Notification.countDocuments(filter);
    const skip = (page - 1) * limit;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      notifications: notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data || null,
        isRead: n.isRead,
        readAt: n.readAt || null,
        createdAt: n.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Marks a single notification as read.
   * @param notificationId - The notification's MongoDB ObjectId.
   * @param userId - The user's UUID (ownership check).
   */
  async markAsRead(notificationId: string, userId: string) {
    logger.debug('notificationService.markAsRead', { notificationId, userId });

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    ).lean();

    if (!notification) {
      throw new AppError('Notification not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: notification._id.toString(),
      isRead: notification.isRead,
      readAt: notification.readAt,
    };
  },

  /**
   * Returns the count of unread notifications for a user.
   * @param userId - The user's UUID.
   */
  async getUnreadCount(userId: string): Promise<number> {
    logger.debug('notificationService.getUnreadCount', { userId });
    return Notification.countDocuments({ userId, isRead: false });
  },

  /**
   * Marks all notifications as read for a user.
   * @param userId - The user's UUID.
   */
  async markAllAsRead(userId: string) {
    logger.debug('notificationService.markAllAsRead', { userId });
    await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  },

  /**
   * Deletes a single notification.
   * @param notificationId - The notification's MongoDB ObjectId.
   * @param userId - The user's UUID (ownership check).
   */
  async deleteOne(notificationId: string, userId: string) {
    logger.debug('notificationService.deleteOne', { notificationId, userId });

    const result = await Notification.findOneAndDelete({ _id: notificationId, userId });
    if (!result) {
      throw new AppError('Notification not found', HttpStatus.NOT_FOUND);
    }
  },

  /**
   * Deletes all notifications for a user.
   * @param userId - The user's UUID.
   * @returns The number of notifications deleted.
   */
  async deleteAll(userId: string): Promise<number> {
    logger.debug('notificationService.deleteAll', { userId });
    const result = await Notification.deleteMany({ userId });
    return result.deletedCount ?? 0;
  },
};
