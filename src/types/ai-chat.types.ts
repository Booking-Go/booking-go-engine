/** Possible intents extracted from AI chat messages. */
export type ChatIntentType =
  | 'SEARCH_BUSINESS'
  | 'CHECK_AVAILABILITY'
  | 'MAKE_BOOKING'
  | 'CANCEL_BOOKING'
  | 'GET_RECOMMENDATIONS'
  | 'GENERAL_QUESTION'
  | 'UNCLEAR';

/** Sentiment labels for review analysis. */
export type SentimentLabel = 'positive' | 'neutral' | 'negative';

/** Role in an AI conversation. */
export type AiChatRole = 'user' | 'assistant' | 'system';

/** Status of an AI conversation session. */
export type AiConversationStatus = 'active' | 'closed';

// ─── Chat Messages ─────────────────────────────────────

/** A single message in an AI chat conversation. */
export interface AiChatMessage {
  role: AiChatRole;
  content: string;
  intent?: ChatIntentType;
  timestamp: Date;
}

/** Structured intent extracted from a user's natural language input. */
export interface ChatIntent {
  intent: ChatIntentType;
  entities: ChatEntities;
  confidence: number;
}

/** Entities parsed from a chat message. */
export interface ChatEntities {
  city?: string;
  category?: string;
  date?: string;
  time?: string;
  businessName?: string;
  serviceName?: string;
  bookingId?: string;
}

// ─── AI Conversation Session ───────────────────────────

/** An active AI chat session stored in Redis for fast context retrieval. */
export interface AiChatSession {
  sessionId: string;
  userId: string;
  messages: AiChatMessage[];
  createdAt: Date;
  lastActiveAt: Date;
}

// ─── Embedding ─────────────────────────────────────────

/** Result of an embedding operation. */
export interface EmbeddingResult {
  entityType: 'business' | 'service';
  entityId: string;
  embedding: number[];
  textUsed: string;
}

// ─── Sentiment ─────────────────────────────────────────

/** Result of a sentiment analysis on a review. */
export interface SentimentResult {
  sentiment: SentimentLabel;
  score: number;
  explanation: string;
}

// ─── AI Chat API Response ──────────────────────────────

/** Response shape returned by the AI chat endpoint. */
export interface AiChatResponse {
  response: string;
  intent: ChatIntentType;
  sessionId: string;
  suggestions?: string[];
}
