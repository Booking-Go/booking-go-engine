import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1, 'Service name is required').max(255),
  description: z.string().max(1000).optional(),
  duration: z.number().int().min(5, 'Minimum duration is 5 minutes').max(480),
  price: z.number().min(0, 'Price cannot be negative'),
  depositAmount: z.number().min(0).default(0),
  maxCapacity: z.number().int().min(1).default(1),
  bufferTime: z.number().int().min(0).max(120).default(0),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
