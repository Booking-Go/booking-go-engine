import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { asyncWrapper } from '../../libs';
import { authenticate, authorize, validate, AuthRequest } from '../../middleware';
import { HttpStatus, Pagination } from '../../core/constants';
import {
  createBusinessSchema,
  updateBusinessSchema,
  businessHoursSchema,
  businessHolidaySchema,
  createServiceSchema,
  updateServiceSchema,
} from '../../core/validators';
import { businessService } from '../../core/services/business.service';
import { serviceService } from '../../core/services/service.service';
import { reviewService } from '../../core/services/review.service';
import { analyticsService } from '../../core/services/analytics.service';

const router = Router();

// ─── Public routes (no auth required) ──────────────────────────
// These are read-only browse endpoints accessible to all visitors.

// GET /businesses/nearby?lat=...&lng=...&radius=...&page=...&limit=...
router.get(
  '/nearby',
  asyncWrapper(async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Valid lat (-90 to 90) and lng (-180 to 180) are required',
        },
      });
      return;
    }

    const radiusKm = Math.min(100, Math.max(1, parseFloat(req.query.radius as string) || 25));
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || 12),
    );

    const filters: Record<string, unknown> = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.search) filters.search = req.query.search;

    const result = await businessService.nearby(lat, lng, radiusKm, page, limit, filters);
    res.status(HttpStatus.OK).json({ success: true, data: result.businesses, meta: result.meta });
  }),
);

// GET /businesses - List all businesses (with filters & pagination)
router.get(
  '/',
  asyncWrapper(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const filters: Record<string, unknown> = {};
    if (req.query.category) filters.category = req.query.category;
    if (req.query.city) filters.city = req.query.city;
    if (req.query.state) filters.state = req.query.state;
    if (req.query.country) filters.country = req.query.country;
    if (req.query.search) filters.search = req.query.search;

    const result = await businessService.list(filters, page, limit);
    res.status(HttpStatus.OK).json({ success: true, data: result.businesses, meta: result.meta });
  }),
);

// GET /businesses/slug/:slug - Get business by slug (public profile)
router.get(
  '/slug/:slug',
  asyncWrapper(async (req: Request, res: Response) => {
    const business = await businessService.getBySlug(req.params.slug);
    res.status(HttpStatus.OK).json({ success: true, data: business });
  }),
);

// GET /businesses/:id - Get business by ID (public profile)
router.get(
  '/:id',
  asyncWrapper(async (req: Request, res: Response) => {
    const business = await businessService.getById(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: business });
  }),
);

// GET /businesses/:id/hours - Get business hours
router.get(
  '/:id/hours',
  asyncWrapper(async (req: Request, res: Response) => {
    const hours = await businessService.getHours(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: hours });
  }),
);

// GET /businesses/:id/services - Get services for a business
router.get(
  '/:id/services',
  asyncWrapper(async (req: Request, res: Response) => {
    const services = await serviceService.getByBusinessId(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: services });
  }),
);

// GET /businesses/:id/services/:serviceId - Get a single service
router.get(
  '/:id/services/:serviceId',
  asyncWrapper(async (req: Request, res: Response) => {
    const service = await serviceService.getById(req.params.serviceId);
    res.status(HttpStatus.OK).json({ success: true, data: service });
  }),
);

// GET /businesses/:id/reviews - Get published reviews for a business
router.get(
  '/:id/reviews',
  asyncWrapper(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const result = await reviewService.getByBusinessId(req.params.id, page, limit);
    res.status(HttpStatus.OK).json({ success: true, data: result.reviews, meta: result.meta });
  }),
);

// ─── Authenticated routes ──────────────────────────────────────
// All routes below require authentication.

router.use(authenticate);

// GET /businesses/mine - Get businesses owned by current user
router.get(
  '/mine',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const businesses = await businessService.getMyBusinesses(req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: businesses });
  }),
);

// POST /businesses - Create new business (business_owner only)
router.post(
  '/',
  authorize('business_owner', 'admin'),
  validate(createBusinessSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const business = await businessService.create(req.user!.id, req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: business });
  }),
);

// PUT /businesses/:id - Update business (owner only)
router.put(
  '/:id',
  authorize('business_owner', 'admin'),
  validate(updateBusinessSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const business = await businessService.update(req.params.id, req.user!.id, req.body);
    res.status(HttpStatus.OK).json({ success: true, data: business });
  }),
);

// DELETE /businesses/:id - Delete business (owner only)
router.delete(
  '/:id',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await businessService.delete(req.params.id, req.user!.id);
    res.status(HttpStatus.NO_CONTENT).send();
  }),
);

// --- Business Hours (write) ---

// PUT /businesses/:id/hours - Set business hours (replace all)
router.put(
  '/:id/hours',
  authorize('business_owner', 'admin'),
  validate(z.array(businessHoursSchema), 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const hours = await businessService.setHours(req.params.id, req.user!.id, req.body);
    res.status(HttpStatus.OK).json({ success: true, data: hours });
  }),
);

// --- Business Holidays ---

// GET /businesses/:id/holidays - Get business holidays
router.get(
  '/:id/holidays',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const holidays = await businessService.getHolidays(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: holidays });
  }),
);

// POST /businesses/:id/holidays - Add a holiday
router.post(
  '/:id/holidays',
  authorize('business_owner', 'admin'),
  validate(businessHolidaySchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const holiday = await businessService.addHoliday(req.params.id, req.user!.id, req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: holiday });
  }),
);

// DELETE /businesses/:id/holidays/:holidayId - Remove a holiday
router.delete(
  '/:id/holidays/:holidayId',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await businessService.removeHoliday(req.params.id, req.user!.id, req.params.holidayId);
    res.status(HttpStatus.NO_CONTENT).send();
  }),
);

// --- Services (write) ---

// POST /businesses/:id/services - Create a service
router.post(
  '/:id/services',
  authorize('business_owner', 'admin'),
  validate(createServiceSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const service = await serviceService.create(req.params.id, req.user!.id, req.body);
    res.status(HttpStatus.CREATED).json({ success: true, data: service });
  }),
);

// PUT /businesses/:id/services/:serviceId - Update a service
router.put(
  '/:id/services/:serviceId',
  authorize('business_owner', 'admin'),
  validate(updateServiceSchema, 'body'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const service = await serviceService.update(req.params.serviceId, req.user!.id, req.body);
    res.status(HttpStatus.OK).json({ success: true, data: service });
  }),
);

// DELETE /businesses/:id/services/:serviceId - Delete a service
router.delete(
  '/:id/services/:serviceId',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await serviceService.delete(req.params.serviceId, req.user!.id);
    res.status(HttpStatus.NO_CONTENT).send();
  }),
);

// GET /businesses/:id/analytics - Get business analytics
router.get(
  '/:id/analytics',
  authenticate,
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const period = (req.query.period as string) || '30d';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const analytics = await analyticsService.getBusinessAnalytics(
      req.params.id,
      req.user!.id,
      req.user!.role,
      period,
      startDate,
      endDate,
    );
    res.status(HttpStatus.OK).json({ success: true, data: analytics });
  }),
);

// GET /businesses/:id/analytics/report - Get revenue report for export
router.get(
  '/:id/analytics/report',
  authenticate,
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    if (!startDate || !endDate) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'startDate and endDate query params are required',
        },
      });
      return;
    }
    const report = await analyticsService.getRevenueReport(
      req.params.id,
      req.user!.id,
      req.user!.role,
      startDate,
      endDate,
    );
    res.status(HttpStatus.OK).json({ success: true, data: report });
  }),
);

export default router;
