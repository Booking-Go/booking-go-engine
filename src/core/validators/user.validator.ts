import { z } from 'zod';

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  profileImage: z.string().url().max(500).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
