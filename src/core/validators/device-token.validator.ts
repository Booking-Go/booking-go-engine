import { z } from 'zod';

/** Schema for registering an FCM device token. */
export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
  deviceType: z.enum(['web', 'android', 'ios']).default('web'),
  userAgent: z.string().optional(),
});

/** Schema for unregistering an FCM device token. */
export const unregisterDeviceTokenSchema = z.object({
  token: z.string().min(1, 'FCM token is required'),
});

export type RegisterDeviceTokenInput = z.infer<typeof registerDeviceTokenSchema>;
export type UnregisterDeviceTokenInput = z.infer<typeof unregisterDeviceTokenSchema>;
