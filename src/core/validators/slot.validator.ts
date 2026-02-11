import { z } from 'zod';
import { AppConfig } from '../constants';

export const createSlotSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }),
  endTime: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }),
  capacity: z.number().int().min(1).max(100).optional().default(1),
  price: z.number().min(0),
  notes: z.string().max(500).optional(),
});

export const bulkCreateSlotsSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  /** Specific time windows per day (HH:mm format). If omitted, auto-generates from business hours + service duration. */
  timeSlots: z.array(z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format'),
  })).optional(),
  /** Which days to generate slots for (0=Mon..6=Sun). If omitted, uses all business-open days. */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  capacity: z.number().int().min(1).max(100).optional().default(1),
  price: z.number().min(0),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'endDate must be on or after startDate', path: ['endDate'] },
);

export const updateSlotSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  price: z.number().min(0).optional(),
  isAvailable: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const availableSlotsQuerySchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
}).refine(
  (data) => data.date || data.startDate,
  { message: 'Either date or startDate is required', path: ['date'] },
);

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type BulkCreateSlotsInput = z.infer<typeof bulkCreateSlotsSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
