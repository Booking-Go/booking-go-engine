import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Embedding repository — PostgreSQL data access for vector embeddings and sentiment.
 * Uses pgvector's `<=>` operator for cosine distance similarity search.
 */
export const embeddingRepository = {
  /**
   * Updates the description embedding for a business.
   * @param businessId - The business UUID.
   * @param embedding - The vector embedding (number array).
   */
  async updateBusinessEmbedding(businessId: string, embedding: number[]): Promise<void> {
    logger.debug('embeddingRepository.updateBusinessEmbedding', { businessId });
    await pgPool.query('UPDATE businesses SET description_embedding = $1 WHERE id = $2', [
      JSON.stringify(embedding),
      businessId,
    ]);
  },

  /**
   * Updates the description embedding for a service.
   * @param serviceId - The service UUID.
   * @param embedding - The vector embedding (number array).
   */
  async updateServiceEmbedding(serviceId: string, embedding: number[]): Promise<void> {
    logger.debug('embeddingRepository.updateServiceEmbedding', { serviceId });
    await pgPool.query('UPDATE services SET description_embedding = $1 WHERE id = $2', [
      JSON.stringify(embedding),
      serviceId,
    ]);
  },

  /**
   * Searches for businesses similar to the query embedding using cosine distance.
   * Only returns active businesses that have embeddings.
   * @param queryEmbedding - The query vector to compare against.
   * @param limit - Maximum number of results (default 10).
   * @param filters - Optional filters (city, category).
   * @returns Array of businesses ranked by similarity with a similarity score.
   */
  async searchSimilarBusinesses(
    queryEmbedding: number[],
    limit = 10,
    filters?: { city?: string; category?: string },
  ) {
    logger.debug('embeddingRepository.searchSimilarBusinesses', { limit, filters });

    const conditions: string[] = ['is_active = true', 'description_embedding IS NOT NULL'];
    const values: unknown[] = [JSON.stringify(queryEmbedding)];
    let paramIndex = 2;

    if (filters?.city) {
      conditions.push(`city ILIKE $${paramIndex}`);
      values.push(filters.city);
      paramIndex++;
    }
    if (filters?.category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(filters.category);
      paramIndex++;
    }

    values.push(limit);

    const whereClause = conditions.join(' AND ');

    const { rows } = await pgPool.query(
      `SELECT id, name, slug, description, category, city, state,
              logo_url, cover_image_url,
              1 - (description_embedding <=> $1) AS similarity
       FROM businesses
       WHERE ${whereClause}
       ORDER BY description_embedding <=> $1
       LIMIT $${paramIndex}`,
      values,
    );

    return rows;
  },

  /**
   * Searches for services similar to the query embedding using cosine distance.
   * Only returns active services that have embeddings.
   * @param queryEmbedding - The query vector to compare against.
   * @param limit - Maximum number of results (default 10).
   * @param businessId - Optional filter to search within a specific business.
   * @returns Array of services ranked by similarity with a similarity score.
   */
  async searchSimilarServices(queryEmbedding: number[], limit = 10, businessId?: string) {
    logger.debug('embeddingRepository.searchSimilarServices', { limit, businessId });

    const conditions: string[] = ['s.is_active = true', 's.description_embedding IS NOT NULL'];
    const values: unknown[] = [JSON.stringify(queryEmbedding)];
    let paramIndex = 2;

    if (businessId) {
      conditions.push(`s.business_id = $${paramIndex}`);
      values.push(businessId);
      paramIndex++;
    }

    values.push(limit);

    const whereClause = conditions.join(' AND ');

    const { rows } = await pgPool.query(
      `SELECT s.id, s.name, s.description, s.duration, s.price,
              s.business_id, b.name AS business_name, b.slug AS business_slug,
              1 - (s.description_embedding <=> $1) AS similarity
       FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE ${whereClause}
       ORDER BY s.description_embedding <=> $1
       LIMIT $${paramIndex}`,
      values,
    );

    return rows;
  },

  /**
   * Updates the sentiment analysis result on a review.
   * @param reviewId - The review UUID.
   * @param sentiment - The sentiment label (positive, neutral, negative).
   * @param score - The sentiment score (0–1).
   */
  async updateReviewSentiment(reviewId: string, sentiment: string, score: number): Promise<void> {
    logger.debug('embeddingRepository.updateReviewSentiment', { reviewId, sentiment, score });
    await pgPool.query('UPDATE reviews SET sentiment = $1, sentiment_score = $2 WHERE id = $3', [
      sentiment,
      score,
      reviewId,
    ]);
  },

  /**
   * Returns all active businesses without embeddings (for batch seeding).
   * @returns Array of { id, name, description, category, city }.
   */
  async findBusinessesWithoutEmbeddings() {
    logger.debug('embeddingRepository.findBusinessesWithoutEmbeddings');
    const { rows } = await pgPool.query(
      `SELECT id, name, description, category, city
       FROM businesses
       WHERE is_active = true AND description_embedding IS NULL
       ORDER BY created_at`,
    );
    return rows;
  },

  /**
   * Returns all active services without embeddings (for batch seeding).
   * @returns Array of { id, name, description, business_id }.
   */
  async findServicesWithoutEmbeddings() {
    logger.debug('embeddingRepository.findServicesWithoutEmbeddings');
    const { rows } = await pgPool.query(
      `SELECT id, name, description, business_id
       FROM services
       WHERE is_active = true AND description_embedding IS NULL
       ORDER BY created_at`,
    );
    return rows;
  },
};
