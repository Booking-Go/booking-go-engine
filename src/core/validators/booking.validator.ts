import { z } from 'zod';

export const createBookingSchema = z.object({
  slotId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const updateBookingSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
