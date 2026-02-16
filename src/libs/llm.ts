import { getOllamaClient, isOllamaAvailable, OllamaConfig } from '../config/ollama';
import { logger } from './logger';

/** Role type for chat messages. */
type ChatRole = 'system' | 'user' | 'assistant';

/** A single message in a chat conversation. */
interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Structured intent extracted from a user message. */
interface ExtractedIntent {
  intent: string;
  entities: Record<string, string>;
  confidence: number;
}

/**
 * LLM utility — stateless wrapper around Ollama for chat, embeddings, and intent extraction.
 *
 * @example
 * ```ts
 * const response = await llm.chat('You are a helpful assistant.', 'Hello!');
 * const embedding = await llm.embed('salon in downtown');
 * const intent = await llm.extractIntent('Book me a haircut tomorrow at 2pm');
 * ```
 */
export const llm = {
  /**
   * Send a chat completion request to Ollama.
   * @param systemPrompt - System-level instructions for the model.
   * @param userMessage - The user's message.
   * @param history - Optional prior conversation messages for context.
   * @returns The model's text response.
   */
  async chat(
    systemPrompt: string,
    userMessage: string,
    history: ChatMessage[] = [],
  ): Promise<string> {
    assertAvailable();

    const client = getOllamaClient();
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const response = await client.chat({
      model: OllamaConfig.chatModel,
      messages,
      stream: false,
    });

    return response.message.content;
  },

  /**
   * Send a streaming chat completion request to Ollama.
   * Returns an async iterable of content chunks — ideal for SSE.
   * @param systemPrompt - System-level instructions for the model.
   * @param userMessage - The user's message.
   * @param history - Optional prior conversation messages for context.
   * @returns Async iterable yielding string chunks.
   */
  async *chatStream(
    systemPrompt: string,
    userMessage: string,
    history: ChatMessage[] = [],
  ): AsyncGenerator<string> {
    assertAvailable();

    const client = getOllamaClient();
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    const stream = await client.chat({
      model: OllamaConfig.chatModel,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.message?.content) {
        yield chunk.message.content;
      }
    }
  },

  /**
   * Generate an embedding vector for a text string.
   * @param text - The text to embed.
   * @returns A number array of length `EMBEDDING_DIMENSIONS` (default 768).
   */
  async embed(text: string): Promise<number[]> {
    assertAvailable();

    const client = getOllamaClient();
    const response = await client.embed({
      model: OllamaConfig.embeddingModel,
      input: text,
    });

    return response.embeddings[0];
  },

  /**
   * Generate embeddings for multiple texts in a single request.
   * @param texts - Array of strings to embed.
   * @returns Array of number arrays (one embedding per input text).
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    assertAvailable();

    const client = getOllamaClient();
    const response = await client.embed({
      model: OllamaConfig.embeddingModel,
      input: texts,
    });

    return response.embeddings;
  },

  /**
   * Extract a structured intent and entities from a user message.
   * Uses the chat model with a JSON-output system prompt.
   * @param userMessage - The user's natural language input.
   * @param context - Optional context (e.g., conversation summary, user location).
   * @returns Parsed intent object with intent type, entities, and confidence.
   */
  async extractIntent(userMessage: string, context?: string): Promise<ExtractedIntent> {
    assertAvailable();

    const systemPrompt = buildIntentPrompt(context);

    const client = getOllamaClient();
    const response = await client.chat({
      model: OllamaConfig.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: false,
      format: 'json',
    });

    try {
      const parsed = JSON.parse(response.message.content) as ExtractedIntent;
      return {
        intent: parsed.intent || 'UNCLEAR',
        entities: parsed.entities || {},
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch {
      logger.warn('Failed to parse intent JSON from LLM', {
        raw: response.message.content,
        userMessage,
      });
      return { intent: 'UNCLEAR', entities: {}, confidence: 0 };
    }
  },

  /**
   * Analyze the sentiment of a review comment.
   * @param comment - The review text to analyze.
   * @returns Sentiment label, score (0–1), and brief explanation.
   */
  async analyzeSentiment(
    comment: string,
  ): Promise<{ sentiment: string; score: number; explanation: string }> {
    assertAvailable();

    const systemPrompt = `You are a sentiment analysis engine. Analyze the following customer review and return a JSON object with exactly these fields:
- "sentiment": one of "positive", "neutral", or "negative"
- "score": a number between 0 and 1 (0 = most negative, 1 = most positive)
- "explanation": a brief one-sentence explanation of why

Return ONLY valid JSON. No other text.`;

    const client = getOllamaClient();
    const response = await client.chat({
      model: OllamaConfig.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: comment },
      ],
      stream: false,
      format: 'json',
    });

    try {
      const parsed = JSON.parse(response.message.content);
      return {
        sentiment: parsed.sentiment || 'neutral',
        score: typeof parsed.score === 'number' ? Math.min(1, Math.max(0, parsed.score)) : 0.5,
        explanation: parsed.explanation || '',
      };
    } catch {
      logger.warn('Failed to parse sentiment JSON from LLM', {
        raw: response.message.content,
        comment: comment.substring(0, 100),
      });
      return { sentiment: 'neutral', score: 0.5, explanation: 'Analysis unavailable' };
    }
  },
};

/**
 * Asserts that the Ollama client is available.
 * @throws Error if Ollama is not connected.
 */
const assertAvailable = (): void => {
  if (!isOllamaAvailable()) {
    throw new Error('AI service unavailable. Ollama is not connected.');
  }
};

/**
 * Builds the system prompt for intent extraction.
 * @param context - Optional extra context to include.
 * @returns A system prompt string.
 */
const buildIntentPrompt = (context?: string): string => {
  const base = `You are an intent classifier for a booking platform (salons, clinics, gyms, spas).
Given a user message, extract the intent and any entities mentioned.

Return a JSON object with exactly these fields:
- "intent": one of "SEARCH_BUSINESS", "CHECK_AVAILABILITY", "MAKE_BOOKING", "CANCEL_BOOKING", "GET_RECOMMENDATIONS", "GENERAL_QUESTION", "UNCLEAR"
- "entities": an object with any of these optional fields: "city", "category", "date", "time", "businessName", "serviceName", "bookingId"
- "confidence": a number between 0 and 1 indicating how confident you are

Rules:
- Only use the intent types listed above.
- Parse dates/times into standard formats when possible (YYYY-MM-DD, HH:MM).
- If the message is ambiguous, set intent to "UNCLEAR" with low confidence.
- Return ONLY valid JSON. No other text.`;

  if (context) {
    return `${base}\n\nAdditional context:\n${context}`;
  }
  return base;
};
