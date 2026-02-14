import { z } from 'zod';

/**
 * Validates the payload for sending a message.
 */
export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be at most 2000 characters'),
});

/** Inferred type for sending a message. */
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Validates the payload for starting a conversation.
 */
export const startConversationSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  message: z.string().trim().max(2000, 'Message must be at most 2000 characters').optional(),
});

/** Inferred type for starting a conversation. */
export type StartConversationInput = z.infer<typeof startConversationSchema>;
