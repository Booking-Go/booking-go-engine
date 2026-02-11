import { Router, Response } from 'express';
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

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /businesses - Get all businesses (with filters & pagination)
router.get(
  '/',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
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

// GET /businesses/mine - Get businesses owned by current user
router.get(
  '/mine',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const businesses = await businessService.getMyBusinesses(req.user!.id);
    res.status(HttpStatus.OK).json({ success: true, data: businesses });
  }),
);

// GET /businesses/:id - Get business by ID
router.get(
  '/:id',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const business = await businessService.getById(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: business });
  }),
);

// GET /businesses/slug/:slug - Get business by slug
router.get(
  '/slug/:slug',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const business = await businessService.getBySlug(req.params.slug);
    res.status(HttpStatus.OK).json({ success: true, data: business });
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

// --- Business Hours ---

// GET /businesses/:id/hours - Get business hours
router.get(
  '/:id/hours',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const hours = await businessService.getHours(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: hours });
  }),
);

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

// --- Services ---

// GET /businesses/:id/services - Get services for a business
router.get(
  '/:id/services',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const services = await serviceService.getByBusinessId(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: services });
  }),
);

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

// GET /businesses/:id/services/:serviceId - Get a single service
router.get(
  '/:id/services/:serviceId',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const service = await serviceService.getById(req.params.serviceId);
    res.status(HttpStatus.OK).json({ success: true, data: service });
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

// --- Reviews ---

// GET /businesses/:id/reviews - Get published reviews for a business
router.get(
  '/:id/reviews',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const result = await reviewService.getByBusinessId(req.params.id, page, limit);
    res.status(HttpStatus.OK).json({ success: true, data: result.reviews, meta: result.meta });
  }),
);

// GET /businesses/:id/analytics - Get business analytics (Sprint 7)
router.get('/:id/analytics', authorize('business_owner', 'admin'), (req, res) => {
  res.status(501).json({ message: 'Get business analytics - To be implemented in Sprint 7' });
});

export default router;
