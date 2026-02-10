import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { validate, authenticate, AuthRequest } from '../../middleware';
import { HttpStatus } from '../../core/constants';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
} from '../../core/validators';
import { authService } from '../../core/services/auth.service';

const router = Router();

// POST /auth/register
router.post(
  '/register',
  validate(registerSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: result });
  }),
);

// POST /auth/login
router.post(
  '/login',
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
  validate(forgotPasswordSchema, 'body'),
  asyncWrapper(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.status(HttpStatus.OK).json({ success: true, data: result });
  }),
);

export default router;
