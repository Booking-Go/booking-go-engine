import { z } from 'zod';

import { AppConfig } from '../constants';

export const createBusinessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(255),
  slug: z.string().min(1).max(AppConfig.SLUG_MAX_LENGTH).regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens only',
  ),
  description: z.string().max(2000).optional(),
  category: z.string().min(1, 'Category is required').max(100),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  website: z.string().url().max(500).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().max(50).default('UTC'),
  logoUrl: z.string().url().max(500).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const businessHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  isClosed: z.boolean().default(false),
});

export const businessHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  reason: z.string().max(255).optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type BusinessHoursInput = z.infer<typeof businessHoursSchema>;
export type BusinessHolidayInput = z.infer<typeof businessHolidaySchema>;
