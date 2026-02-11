import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { authenticate, authorize, AuthRequest } from '../../middleware';
import { HttpStatus, Pagination } from '../../core/constants';
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
  createReviewSchema,
} from '../../core/validators';
import { bookingService } from '../../core/services/booking.service';
import { reviewService } from '../../core/services/review.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /bookings — list bookings (role-aware: customer=own, owner=their businesses)
router.get(
  '/',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const filters: { status?: string; startDate?: string; endDate?: string } = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.startDate) filters.startDate = req.query.startDate as string;
    if (req.query.endDate) filters.endDate = req.query.endDate as string;

    const result = await bookingService.listForUser(req.user!.id, req.user!.role, page, limit, filters);
    res.status(HttpStatus.OK).json({ success: true, data: result.bookings, meta: result.meta });
  }),
);

// GET /bookings/:id — single booking detail
router.get(
  '/:id',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const booking = await bookingService.getById(req.params.id, req.user!.id, req.user!.role);
    res.status(HttpStatus.OK).json({ success: true, data: booking });
  }),
);

// POST /bookings — create a new booking (any authenticated user)
router.post(
  '/',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = createBookingSchema.parse(req.body);
    const booking = await bookingService.create(req.user!.id, input);
    res.status(HttpStatus.CREATED).json({ success: true, data: booking });
  }),
);

// PUT /bookings/:id — update booking notes
router.put(
  '/:id',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = updateBookingSchema.parse(req.body);
    const booking = await bookingService.update(req.params.id, req.user!.id, input);
    res.status(HttpStatus.OK).json({ success: true, data: booking });
  }),
);

// POST /bookings/:id/confirm — owner confirms a pending booking
router.post(
  '/:id/confirm',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const booking = await bookingService.confirm(req.params.id, req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: booking });
  }),
);

// POST /bookings/:id/cancel — customer or owner cancels
router.post(
  '/:id/cancel',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = cancelBookingSchema.parse(req.body);
    const booking = await bookingService.cancel(req.params.id, req.user!.id, req.user!.role, input);
    res.status(HttpStatus.OK).json({ success: true, data: booking });
  }),
);

// POST /bookings/:id/complete — owner marks as completed
router.post(
  '/:id/complete',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const booking = await bookingService.complete(req.params.id, req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: booking });
  }),
);

// POST /bookings/:id/review — customer submits a review for a completed booking
router.post(
  '/:id/review',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = createReviewSchema.parse(req.body);
    const review = await reviewService.create(req.params.id, req.user!.id, input);
    res.status(HttpStatus.CREATED).json({ success: true, data: review });
  }),
);

export default router;
