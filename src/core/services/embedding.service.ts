import { logger, llm, cache } from '../../libs';
import { isOllamaAvailable } from '../../config/ollama';
import { CacheKeys, CacheTTL } from '../constants';
import { embeddingRepository } from '../repositories/embedding.repository';
import { businessRepository } from '../repositories/business.repository';
import { serviceRepository } from '../repositories/service.repository';
import type { AiSearchInput } from '../validators/ai-chat.validator';

/**
 * Embedding service — generates and manages vector embeddings for semantic search.
 * Wraps the LLM embedding calls + repository persistence.
 */
export const embeddingService = {
  /**
   * Generates and stores an embedding for a business.
   * Concatenates name + description + category + city into a single text.
   * @param businessId - The business UUID.
   */
  async generateBusinessEmbedding(businessId: string): Promise<void> {
    if (!isOllamaAvailable()) {
      logger.warn('Skipping business embedding — Ollama unavailable', { businessId });
      return;
    }

    try {
      const business = await businessRepository.findById(businessId);
      if (!business) {
        logger.warn('Business not found for embedding', { businessId });
        return;
      }

      const text = buildBusinessText(business);
      const embedding = await llm.embed(text);

      await embeddingRepository.updateBusinessEmbedding(businessId, embedding);

      // Cache the embedding for quick re-use
      await cache.set(
        CacheKeys.aiEmbedding('business', businessId),
        embedding,
        CacheTTL.AI_EMBEDDING,
      );

      logger.info('Business embedding generated', { businessId, textLength: text.length });
    } catch (err: unknown) {
      logger.error('Failed to generate business embedding', { businessId, error: err });
    }
  },

  /**
   * Generates and stores an embedding for a service.
   * Concatenates name + description into a single text.
   * @param serviceId - The service UUID.
   */
  async generateServiceEmbedding(serviceId: string): Promise<void> {
    if (!isOllamaAvailable()) {
      logger.warn('Skipping service embedding — Ollama unavailable', { serviceId });
      return;
    }

    try {
      const service = await serviceRepository.findById(serviceId);
      if (!service) {
        logger.warn('Service not found for embedding', { serviceId });
        return;
      }

      const text = buildServiceText(service);
      const embedding = await llm.embed(text);

      await embeddingRepository.updateServiceEmbedding(serviceId, embedding);

      await cache.set(
        CacheKeys.aiEmbedding('service', serviceId),
        embedding,
        CacheTTL.AI_EMBEDDING,
      );

      logger.info('Service embedding generated', { serviceId, textLength: text.length });
    } catch (err: unknown) {
      logger.error('Failed to generate service embedding', { serviceId, error: err });
    }
  },

  /**
   * Generates embeddings for all businesses and services that don't have one yet.
   * Processes in batches to avoid overwhelming Ollama.
   * @returns Summary of how many embeddings were generated.
   */
  async generateAllEmbeddings(): Promise<{ businesses: number; services: number }> {
    if (!isOllamaAvailable()) {
      logger.warn('Skipping bulk embedding — Ollama unavailable');
      return { businesses: 0, services: 0 };
    }

    let businessCount = 0;
    let serviceCount = 0;

    // Process businesses
    const businesses = await embeddingRepository.findBusinessesWithoutEmbeddings();
    logger.info(`Generating embeddings for ${businesses.length} businesses`);

    for (const business of businesses) {
      try {
        const text = buildBusinessText(business);
        const embedding = await llm.embed(text);
        await embeddingRepository.updateBusinessEmbedding(business.id, embedding);
        businessCount++;

        if (businessCount % 10 === 0) {
          logger.info(`Business embeddings progress: ${businessCount}/${businesses.length}`);
        }
      } catch (err: unknown) {
        logger.error('Failed to embed business', { businessId: business.id, error: err });
      }
    }

    // Process services
    const services = await embeddingRepository.findServicesWithoutEmbeddings();
    logger.info(`Generating embeddings for ${services.length} services`);

    for (const service of services) {
      try {
        const text = buildServiceText(service);
        const embedding = await llm.embed(text);
        await embeddingRepository.updateServiceEmbedding(service.id, embedding);
        serviceCount++;

        if (serviceCount % 10 === 0) {
          logger.info(`Service embeddings progress: ${serviceCount}/${services.length}`);
        }
      } catch (err: unknown) {
        logger.error('Failed to embed service', { serviceId: service.id, error: err });
      }
    }

    logger.info('Bulk embedding complete', { businesses: businessCount, services: serviceCount });
    return { businesses: businessCount, services: serviceCount };
  },

  /**
   * Semantic search — embeds the query text and finds similar businesses or services.
   * @param input - Validated search input (query, type, filters).
   * @returns Array of results ranked by similarity.
   */
  async searchByText(input: AiSearchInput) {
    if (!isOllamaAvailable()) {
      logger.warn('Semantic search unavailable — Ollama not connected');
      return [];
    }

    const queryEmbedding = await llm.embed(input.query);

    if (input.type === 'service') {
      return embeddingRepository.searchSimilarServices(queryEmbedding, input.limit);
    }

    return embeddingRepository.searchSimilarBusinesses(queryEmbedding, input.limit, {
      city: input.city,
      category: input.category,
    });
  },
};

/**
 * Builds the text representation of a business for embedding.
 * @param business - Business row from PostgreSQL.
 * @returns Concatenated text string.
 */
const buildBusinessText = (business: Record<string, unknown>): string => {
  const parts = [
    business.name,
    business.description,
    business.category,
    business.city,
    business.state,
  ].filter(Boolean);

  return parts.join(' — ');
};

/**
 * Builds the text representation of a service for embedding.
 * @param service - Service row from PostgreSQL.
 * @returns Concatenated text string.
 */
const buildServiceText = (service: Record<string, unknown>): string => {
  const parts = [service.name, service.description].filter(Boolean);

  return parts.join(' — ');
};
