import { z } from 'zod';

export const createBookingSchema = z.object({
  slotId: z.string().uuid(),
  numberOfPeople: z.number().int().min(1).max(50).optional().default(1),
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
