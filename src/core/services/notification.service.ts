import { logger } from '../../libs';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, NotificationType, Pagination } from '../constants';
import { Notification } from '../../models';

/**
 * Notification service — creates and queries in-app notifications (MongoDB).
 */
export const notificationService = {
  /**
   * Creates a new notification document.
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
    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  },
};
