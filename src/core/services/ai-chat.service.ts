import crypto from 'crypto';

import { logger, llm, cache } from '../../libs';
import { isOllamaAvailable } from '../../config/ollama';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, CacheKeys, CacheTTL } from '../constants';
import { AiConversation } from '../../models/aiConversation.model';
import { embeddingService } from './embedding.service';
import { businessService } from './business.service';
import { slotService } from './slot.service';
import { bookingService } from './booking.service';

import type { AiChatMessage, AiChatResponse, AiChatSession, ChatIntentType } from '../../types';
import type { SendAiMessageInput, AiSearchInput } from '../validators';

const SYSTEM_PROMPT = `You are BookingBot, a helpful AI assistant for a booking platform called Booking.go.
You help users:
- Search for businesses (salons, clinics, gyms) by name, category, or location.
- Check available time slots for businesses and services.
- Make bookings and view their upcoming appointments.
- Get personalized recommendations based on their preferences.
- Answer general questions about how the platform works.

Guidelines:
- Be friendly, concise, and helpful.
- When search results are available, present them clearly with key details (name, category, city, rating).
- When showing available slots, format times in a user-friendly way.
- If you need more information to help, ask specific follow-up questions.
- Never make up business names, services, or availability — only use data provided to you.
- Keep responses under 500 words.`;

/**
 * AI Chat service — orchestrates conversations between users and the LLM.
 * Routes user intents to the appropriate domain services and builds contextual responses.
 */
export const aiChatService = {
  /**
   * Processes a user message and returns an AI response with relevant data.
   * @param userId - The authenticated user's ID.
   * @param input - Validated message input (message, optional sessionId).
   * @returns AI response with intent and session context.
   */
  async sendMessage(userId: string, input: SendAiMessageInput): Promise<AiChatResponse> {
    if (!isOllamaAvailable()) {
      throw new AppError('AI chat is temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    logger.debug('aiChatService.sendMessage', { userId, sessionId: input.sessionId });

    // 1. Get or create session
    const session = await getOrCreateSession(userId, input.sessionId);

    // 2. Extract intent from the user message
    const intent = await llm.extractIntent(input.message);
    const intentType = intent.intent as ChatIntentType;
    logger.info('Intent extracted', { intent: intentType, confidence: intent.confidence });

    // 3. Gather context based on intent
    const context = await gatherContext(userId, intent, input.message);

    // 4. Build message history for LLM (last 10 messages for context)
    const history: { role: 'user' | 'assistant'; content: string }[] = session.messages
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // 5. Build the user message with context
    const enrichedMessage = context
      ? `User message: "${input.message}"\n\nRelevant data:\n${context}`
      : input.message;

    // 6. Get LLM response
    const response = await llm.chat(SYSTEM_PROMPT, enrichedMessage, history);

    // 7. Persist messages to session and DB
    const userMessage: AiChatMessage = {
      role: 'user',
      content: input.message,
      intent: intentType,
      timestamp: new Date(),
    };
    const assistantMessage: AiChatMessage = {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };

    session.messages.push(userMessage, assistantMessage);
    session.lastActiveAt = new Date();

    // Update Redis cache
    await cache.set(
      CacheKeys.aiChatSession(userId),
      JSON.stringify(session),
      CacheTTL.AI_CHAT_SESSION,
    );

    // Persist to MongoDB (fire-and-forget)
    persistToDb(session).catch((err: unknown) => {
      logger.warn('Failed to persist AI conversation to DB', { error: err });
    });

    return {
      response,
      intent: intentType,
      sessionId: session.sessionId,
      suggestions: buildSuggestions(intentType),
    };
  },

  /**
   * Processes a user message and streams the AI response token-by-token via SSE.
   * Performs intent extraction and context gathering synchronously, then yields tokens.
   * @param userId - The authenticated user's ID.
   * @param input - Validated message input (message, optional sessionId).
   * @param onMeta - Called once with sessionId and intent before streaming starts.
   * @param onToken - Called for each text token as it arrives from the LLM.
   * @param onDone - Called when the stream finishes with suggestions and full response.
   */
  async sendMessageStream(
    userId: string,
    input: SendAiMessageInput,
    onMeta: (meta: { sessionId: string; intent: string }) => void,
    onToken: (token: string) => void,
    onDone: (data: { suggestions: string[]; response: string }) => void,
  ): Promise<void> {
    if (!isOllamaAvailable()) {
      throw new AppError('AI chat is temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    logger.debug('aiChatService.sendMessageStream', { userId, sessionId: input.sessionId });

    // 1. Get or create session
    const session = await getOrCreateSession(userId, input.sessionId);

    // 2. Extract intent
    const intent = await llm.extractIntent(input.message);
    const intentType = intent.intent as ChatIntentType;
    logger.info('Intent extracted', { intent: intentType, confidence: intent.confidence });

    // 3. Gather context
    const context = await gatherContext(userId, intent, input.message);

    // 4. Build history (last 10 messages)
    const history: { role: 'user' | 'assistant'; content: string }[] = session.messages
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // 5. Enriched message
    const enrichedMessage = context
      ? `User message: "${input.message}"\n\nRelevant data:\n${context}`
      : input.message;

    // 6. Send metadata event
    onMeta({ sessionId: session.sessionId, intent: intentType });

    // 7. Stream tokens from LLM
    let fullResponse = '';
    for await (const token of llm.chatStream(SYSTEM_PROMPT, enrichedMessage, history)) {
      fullResponse += token;
      onToken(token);
    }

    // 8. Build suggestions
    const suggestions = buildSuggestions(intentType);
    onDone({ suggestions, response: fullResponse });

    // 9. Persist messages (fire-and-forget)
    const userMessage: AiChatMessage = {
      role: 'user',
      content: input.message,
      intent: intentType,
      timestamp: new Date(),
    };
    const assistantMessage: AiChatMessage = {
      role: 'assistant',
      content: fullResponse,
      timestamp: new Date(),
    };

    session.messages.push(userMessage, assistantMessage);
    session.lastActiveAt = new Date();

    await cache.set(
      CacheKeys.aiChatSession(userId),
      JSON.stringify(session),
      CacheTTL.AI_CHAT_SESSION,
    );

    persistToDb(session).catch((err: unknown) => {
      logger.warn('Failed to persist AI conversation to DB', { error: err });
    });
  },

  /**
   * Returns chat history for a user's active or past sessions.
   * @param userId - The authenticated user's ID.
   * @param page - Page number.
   * @param limit - Items per page.
   */
  async getHistory(userId: string, page: number = 1, limit: number = 20) {
    logger.debug('aiChatService.getHistory', { userId, page, limit });

    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      AiConversation.find({ userId }).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      AiConversation.countDocuments({ userId }),
    ]);

    return {
      conversations: conversations.map((c) => ({
        sessionId: c.sessionId,
        status: c.status,
        messageCount: c.messageCount,
        lastMessage:
          c.messages.length > 0 ? c.messages[c.messages.length - 1].content.substring(0, 100) : '',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Returns the full message list for a specific session.
   * @param userId - The authenticated user's ID.
   * @param sessionId - The session to retrieve.
   */
  async getSession(userId: string, sessionId: string) {
    logger.debug('aiChatService.getSession', { userId, sessionId });

    const conversation = await AiConversation.findOne({ userId, sessionId }).lean();
    if (!conversation) {
      throw new AppError('Chat session not found', HttpStatus.NOT_FOUND);
    }

    return {
      sessionId: conversation.sessionId,
      status: conversation.status,
      messages: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
        intent: m.intent,
        timestamp: m.timestamp,
      })),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  },

  /**
   * Closes and clears a chat session.
   * @param userId - The authenticated user's ID.
   * @param sessionId - The session to end (optional — clears active if omitted).
   */
  async endSession(userId: string, sessionId?: string) {
    logger.debug('aiChatService.endSession', { userId, sessionId });

    // Clear Redis cache
    await cache.del(CacheKeys.aiChatSession(userId));

    if (sessionId) {
      await AiConversation.updateOne({ userId, sessionId }, { $set: { status: 'closed' } });
    }

    return { success: true };
  },

  /**
   * Performs a semantic search via AI embeddings.
   * @param input - Validated search input (query, type, filters).
   */
  async search(input: AiSearchInput) {
    if (!isOllamaAvailable()) {
      throw new AppError('AI search is temporarily unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    logger.debug('aiChatService.search', { query: input.query, type: input.type });

    const results = await embeddingService.searchByText(input);

    return { results, query: input.query, type: input.type };
  },
};

// ─── Private Helpers ───────────────────────────────────

/**
 * Retrieves an existing session from Redis or creates a new one.
 */
const getOrCreateSession = async (userId: string, sessionId?: string): Promise<AiChatSession> => {
  // Try to restore from Redis
  const cached = await cache.get<string>(CacheKeys.aiChatSession(userId));
  if (cached) {
    const session: AiChatSession = JSON.parse(cached as string);
    // If the caller provided a sessionId and it matches, reuse it
    if (!sessionId || session.sessionId === sessionId) {
      return session;
    }
  }

  // If a specific sessionId was requested, try to restore from MongoDB
  if (sessionId) {
    const doc = await AiConversation.findOne({ userId, sessionId }).lean();
    if (doc) {
      const session: AiChatSession = {
        sessionId: doc.sessionId,
        userId,
        messages: doc.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          intent: m.intent as AiChatMessage['intent'],
          timestamp: new Date(m.timestamp),
        })),
        createdAt: new Date(doc.createdAt),
        lastActiveAt: new Date(doc.updatedAt),
      };

      await cache.set(
        CacheKeys.aiChatSession(userId),
        JSON.stringify(session),
        CacheTTL.AI_CHAT_SESSION,
      );

      return session;
    }
  }

  // Create a new session
  const newSession: AiChatSession = {
    sessionId: crypto.randomUUID(),
    userId,
    messages: [],
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };

  return newSession;
};

interface ExtractedIntent {
  intent: string;
  entities: Record<string, string>;
  confidence: number;
}

/**
 * Gathers data context based on the extracted intent to enrich the LLM prompt.
 */
const gatherContext = async (
  userId: string,
  intent: ExtractedIntent,
  message: string,
): Promise<string | null> => {
  try {
    switch (intent.intent) {
      case 'SEARCH_BUSINESS':
      case 'GET_RECOMMENDATIONS': {
        const results = await embeddingService.searchByText({
          query: message,
          type: 'business',
          city: intent.entities.city,
          category: intent.entities.category,
          limit: 5,
        });

        if (results.length === 0) {
          // Fall back to keyword search
          const filters: Record<string, unknown> = {};
          if (intent.entities.city) filters.city = intent.entities.city;
          if (intent.entities.category) filters.category = intent.entities.category;
          if (intent.entities.businessName) filters.search = intent.entities.businessName;

          const keywordResults = await businessService.list(filters, 1, 5);
          if (keywordResults.businesses.length === 0) {
            return 'No businesses found matching the query. Suggest the user try different search terms or browse categories.';
          }

          return formatBusinessResults(keywordResults.businesses);
        }

        return formatSearchResults(results);
      }

      case 'CHECK_AVAILABILITY': {
        if (!intent.entities.businessName) {
          return 'The user wants to check availability but did not specify a business. Ask which business they are interested in.';
        }

        // Search for the business
        const businesses = await embeddingService.searchByText({
          query: intent.entities.businessName,
          type: 'business',
          limit: 1,
        });

        if (businesses.length === 0) {
          return `Could not find a business matching "${intent.entities.businessName}". Ask the user to clarify.`;
        }

        const biz = businesses[0] as Record<string, unknown>;
        const businessId = biz.id as string;

        const query: Record<string, unknown> = { businessId };
        if (intent.entities.date) {
          query.date = intent.entities.date;
        } else {
          // Default to today
          query.date = new Date().toISOString().split('T')[0];
        }

        const slots = await slotService.getAvailable(
          query as { businessId: string; date?: string },
        );
        if (slots.length === 0) {
          return `Business: ${biz.name}\nNo available slots found for the requested date. Suggest the user try another date.`;
        }

        const slotList = slots
          .slice(0, 10)
          .map((s: Record<string, unknown>) => `  - ${s.startTime} to ${s.endTime} ($${s.price})`)
          .join('\n');

        return `Business: ${biz.name}\nAvailable slots:\n${slotList}`;
      }

      case 'MAKE_BOOKING': {
        return 'The user wants to make a booking. Ask for: 1) Which business, 2) Which date/time, 3) How many people. You can help them search for businesses or check availability first.';
      }

      case 'CANCEL_BOOKING': {
        // Show the user's upcoming bookings
        const bookings = await bookingService.listForUser(userId, 'customer', 1, 5, {
          status: 'confirmed',
        });

        if (bookings.bookings.length === 0) {
          return 'The user has no confirmed bookings to cancel.';
        }

        const bookingList = bookings.bookings
          .map(
            (b: Record<string, unknown>) =>
              `  - Booking ${(b.id as string).substring(0, 8)}... at ${b.businessName} on ${b.bookingDate} (${b.startTime})`,
          )
          .join('\n');

        return `User's confirmed bookings:\n${bookingList}\n\nAsk which booking they want to cancel and confirm before proceeding.`;
      }

      case 'GENERAL_QUESTION':
      case 'UNCLEAR':
      default:
        return null;
    }
  } catch (err: unknown) {
    logger.warn('Failed to gather context for AI chat', { intent: intent.intent, error: err });
    return null;
  }
};

/**
 * Formats semantic search results into context text.
 */
const formatSearchResults = (results: Record<string, unknown>[]): string => {
  if (results.length === 0) return 'No results found.';

  const lines = results.map((r, i) => {
    const similarity = r.similarity
      ? ` (${Math.round((r.similarity as number) * 100)}% match)`
      : '';
    return `${i + 1}. ${r.name}${similarity}\n   Category: ${r.category || 'N/A'} | City: ${r.city || 'N/A'}${r.description ? `\n   ${(r.description as string).substring(0, 120)}` : ''}`;
  });

  return `Found ${results.length} results:\n${lines.join('\n')}`;
};

/**
 * Formats keyword-search business results into context text.
 */
const formatBusinessResults = (businesses: Record<string, unknown>[]): string => {
  const lines = businesses.map((b, i) => `${i + 1}. ${b.name} — ${b.category} in ${b.city}`);
  return `Found ${businesses.length} businesses:\n${lines.join('\n')}`;
};

/**
 * Returns follow-up suggestion buttons based on the detected intent.
 */
const buildSuggestions = (intent: string): string[] => {
  switch (intent) {
    case 'SEARCH_BUSINESS':
    case 'GET_RECOMMENDATIONS':
      return ['Check availability', 'Show more results', 'Book an appointment'];
    case 'CHECK_AVAILABILITY':
      return ['Book this slot', 'Check another date', 'Search for other businesses'];
    case 'MAKE_BOOKING':
      return ['Check availability first', 'Search for businesses'];
    case 'CANCEL_BOOKING':
      return ['View my bookings', 'Rebook'];
    default:
      return ['Search for businesses', 'Check availability', 'View my bookings'];
  }
};

/**
 * Persists the session to MongoDB for long-term storage.
 */
const persistToDb = async (session: AiChatSession): Promise<void> => {
  await AiConversation.findOneAndUpdate(
    { sessionId: session.sessionId },
    {
      $set: {
        userId: session.userId,
        messages: session.messages,
        messageCount: session.messages.length,
        status: 'active',
      },
    },
    { upsert: true },
  );
};
