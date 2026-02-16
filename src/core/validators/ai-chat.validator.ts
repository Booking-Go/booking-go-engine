import { z } from 'zod';

/**
 * Validates the payload for sending a message to the AI chat.
 */
export const sendAiMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(1000, 'Message must be at most 1000 characters'),
  sessionId: z.string().uuid('Invalid session ID').optional(),
});

/** Inferred type for sending an AI chat message. */
export type SendAiMessageInput = z.infer<typeof sendAiMessageSchema>;

/**
 * Validates the payload for semantic search via AI.
 */
export const aiSearchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'Search query cannot be empty')
    .max(500, 'Search query must be at most 500 characters'),
  type: z.enum(['business', 'service']).default('business'),
  city: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

/** Inferred type for AI semantic search. */
export type AiSearchInput = z.infer<typeof aiSearchSchema>;
