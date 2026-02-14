import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { authenticate, authorize, validate, AuthRequest } from '../../middleware';
import {
  HttpStatus,
  Pagination,
  updateUserSchema,
  registerDeviceTokenSchema,
  unregisterDeviceTokenSchema,
  userService,
  notificationService,
  pushService,
} from '../../core';

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

// GET /users - Get all users (admin only)
router.get(
  '/',
  authorize('admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const result = await userService.listUsers(page, limit);
    res.status(HttpStatus.OK).json({ success: true, data: result.users, meta: result.meta });
  }),
);

// GET /users/:id - Get user by ID (admin only)
router.get(
  '/:id',
  authorize('admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const user = await userService.getUserById(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: user });
  }),
);

// DELETE /users/:id - Deactivate user (admin only)
router.delete(
  '/:id',
  authorize('admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const user = await userService.deleteUser(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: user });
  }),
);

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
    res
      .status(HttpStatus.OK)
      .json({ success: true, data: result.notifications, meta: result.meta });
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
    res
      .status(HttpStatus.OK)
      .json({ success: true, data: { message: 'All notifications marked as read' } });
  }),
);

// DELETE /users/me/notifications/:id - Delete a single notification
router.delete(
  '/me/notifications/:id',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await notificationService.deleteOne(req.params.id, req.user!.id);
    res.status(HttpStatus.NO_CONTENT).send();
  }),
);

// DELETE /users/me/notifications - Clear all notifications
router.delete(
  '/me/notifications',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const count = await notificationService.deleteAll(req.user!.id);
    res
      .status(HttpStatus.OK)
      .json({ success: true, data: { message: `${count} notifications cleared` } });
  }),
);

// ─── Push notification (FCM) token management ───────────────────────────────

// POST /users/me/device-tokens - Register an FCM device token
router.post(
  '/me/device-tokens',
  validate(registerDeviceTokenSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const { token, deviceType, userAgent } = req.body;
    await pushService.registerToken(req.user!.id, token, deviceType, userAgent);
    res.status(HttpStatus.OK).json({
      success: true,
      data: { message: 'Device token registered' },
    });
  }),
);

// DELETE /users/me/device-tokens - Unregister an FCM device token
router.delete(
  '/me/device-tokens',
  validate(unregisterDeviceTokenSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;
    await pushService.unregisterToken(req.user!.id, token);
    res.status(HttpStatus.OK).json({
      success: true,
      data: { message: 'Device token unregistered' },
    });
  }),
);

export default router;
