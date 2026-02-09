import { z } from 'zod';

export const createSlotSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startTime: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }),
  endTime: z.string().datetime({ message: 'Must be a valid ISO 8601 datetime' }),
});

export const bulkCreateSlotsSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  // Auto-generates slots based on business hours + service duration
});

export const updateSlotSchema = z.object({
  status: z.enum(['available', 'booked', 'blocked']).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export const availableSlotsQuerySchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type BulkCreateSlotsInput = z.infer<typeof bulkCreateSlotsSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
