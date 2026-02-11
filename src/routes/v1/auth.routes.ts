import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { validate, authenticate, authRateLimiter, AuthRequest } from '../../middleware';
import { HttpStatus } from '../../core/constants';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../core/validators';
import { authService } from '../../core/services/auth.service';

const router = Router();

// POST /auth/register
router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  }),
);

// POST /auth/login
router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.login(req.body);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }),
);

// POST /auth/refresh
router.post(
  '/refresh',
  validate(refreshTokenSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }),
);

// POST /auth/logout — requires authentication
router.post(
  '/logout',
  authenticate,
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await authService.logout(req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: { message: 'Logged out successfully' } });
  }),
);

// POST /auth/forgot-password
router.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }),
);

// POST /auth/reset-password
router.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.resetPassword(req.body.token, req.body.password);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }),
);

export default router;
