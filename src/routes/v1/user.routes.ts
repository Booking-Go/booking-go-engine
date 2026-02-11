import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { authenticate, authorize, validate, AuthRequest } from '../../middleware';
import { HttpStatus, Pagination } from '../../core/constants';
import { updateUserSchema } from '../../core/validators';
import { userService } from '../../core/services/user.service';
import { notificationService } from '../../core/services/notification.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /users/me - Get current user profile
router.get(
  '/me',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const profile = await userService.getProfile(req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: profile });
  }),
);

// PUT /users/me - Update current user profile
router.put(
  '/me',
  validate(updateUserSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const updated = await userService.updateProfile(req.user!.id, req.body);
    res.status(HttpStatus.OK).json({ success: true, data: updated });
  }),
);

// GET /users/:id - Get user by ID (admin only)
router.get('/:id', authorize('admin'), (req, res) => {
  // TODO: Implement in Sprint 8
  res.status(501).json({ message: 'Get user by ID - To be implemented' });
});

// GET /users - Get all users (admin only)
router.get('/', authorize('admin'), (req, res) => {
  // TODO: Implement in Sprint 8
  res.status(501).json({ message: 'Get all users - To be implemented' });
});

// DELETE /users/:id - Delete user (admin only)
router.delete('/:id', authorize('admin'), (req, res) => {
  // TODO: Implement in Sprint 8
  res.status(501).json({ message: 'Delete user - To be implemented' });
});

// GET /users/me/notifications - Get user notifications
router.get(
  '/me/notifications',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await notificationService.getForUser(req.user!.id, page, limit, unreadOnly);
    res.status(HttpStatus.OK).json({ success: true, data: result.notifications, meta: result.meta });
  }),
);

// GET /users/me/notifications/unread-count - Get unread notification count
router.get(
  '/me/notifications/unread-count',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: { count } });
  }),
);

// PUT /users/me/notifications/:id/read - Mark notification as read
router.put(
  '/me/notifications/:id/read',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const result = await notificationService.markAsRead(req.params.id, req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }),
);

// PUT /users/me/notifications/read-all - Mark all notifications as read
router.put(
  '/me/notifications/read-all',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await notificationService.markAllAsRead(req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: { message: 'All notifications marked as read' } });
  }),
);

export default router;
