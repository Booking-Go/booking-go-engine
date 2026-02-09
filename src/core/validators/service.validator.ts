import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(255),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5, 'Minimum duration is 5 minutes').max(480),
  price: z.number().min(0, 'Price cannot be negative'),
  currency: z.string().length(3).default('INR'),
  maxCapacity: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
