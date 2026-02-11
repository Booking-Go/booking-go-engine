import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { authenticate, authorize, AuthRequest } from '../../middleware';
import { HttpStatus, Pagination } from '../../core/constants';
import {
  createSlotSchema,
  bulkCreateSlotsSchema,
  updateSlotSchema,
  availableSlotsQuerySchema,
} from '../../core/validators';
import { slotService } from '../../core/services/slot.service';

const router = Router();

// ─── Public route ────────────────────────────────────────────

// GET /slots/available?businessId=...&date=... — publicly browseable
router.get(
  '/available',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const parsed = availableSlotsQuerySchema.parse({
      businessId: req.query.businessId,
      serviceId: req.query.serviceId || undefined,
      date: req.query.date || undefined,
      startDate: req.query.startDate || undefined,
      endDate: req.query.endDate || undefined,
    });

    const slots = await slotService.getAvailable(parsed);
    res.status(HttpStatus.OK).json({ success: true, data: slots });
  }),
);

// ─── Authenticated routes ────────────────────────────────────
router.use(authenticate);

// GET /slots?businessId=...&page=1&limit=20 — owner view (all slots with status)
router.get(
  '/',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'businessId query parameter is required' },
      });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const filters: { serviceId?: string; date?: string; isAvailable?: boolean } = {};
    if (req.query.serviceId) filters.serviceId = req.query.serviceId as string;
    if (req.query.date) filters.date = req.query.date as string;
    if (req.query.isAvailable !== undefined) filters.isAvailable = req.query.isAvailable === 'true';

    const result = await slotService.list(businessId, req.user!.id, page, limit, filters);
    res.status(HttpStatus.OK).json({ success: true, data: result.slots, meta: result.meta });
  }),
);

// GET /slots/:id — single slot detail
router.get(
  '/:id',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const slot = await slotService.getById(req.params.id);
    res.status(HttpStatus.OK).json({ success: true, data: slot });
  }),
);

// POST /slots — create single slot
router.post(
  '/',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = createSlotSchema.parse(req.body);
    const slot = await slotService.create(req.user!.id, input);
    res.status(HttpStatus.CREATED).json({ success: true, data: slot });
  }),
);

// POST /slots/bulk — auto-generate slots from business hours + service duration
router.post(
  '/bulk',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = bulkCreateSlotsSchema.parse(req.body);
    const result = await slotService.bulkCreate(req.user!.id, input);
    res.status(HttpStatus.CREATED).json({
      success: true,
      data: { created: result.created, message: `Successfully created ${result.created} slots` },
    });
  }),
);

// PUT /slots/:id — update slot (time, capacity, price, availability)
router.put(
  '/:id',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = updateSlotSchema.parse(req.body);
    const slot = await slotService.update(req.params.id, req.user!.id, input);
    res.status(HttpStatus.OK).json({ success: true, data: slot });
  }),
);

// DELETE /slots/:id — delete slot (only if no bookings)
router.delete(
  '/:id',
  authorize('business_owner', 'admin'),
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await slotService.delete(req.params.id, req.user!.id);
    res.status(HttpStatus.NO_CONTENT).send();
  }),
);

export default router;
