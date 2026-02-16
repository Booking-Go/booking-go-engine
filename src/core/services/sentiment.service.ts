import { logger, llm } from '../../libs';
import { isOllamaAvailable } from '../../config/ollama';
import { pgPool } from '../../config';
import { embeddingRepository } from '../repositories/embedding.repository';

/**
 * Sentiment service — analyzes review text using the LLM and persists results.
 */
export const sentimentService = {
  /**
   * Analyzes the sentiment of a review comment and stores the result.
   * Designed to be called fire-and-forget after review creation.
   * @param reviewId - The review UUID.
   * @param comment - The review text to analyze.
   */
  async analyzeReview(reviewId: string, comment: string): Promise<void> {
    if (!isOllamaAvailable()) {
      logger.warn('Skipping sentiment analysis — Ollama unavailable', { reviewId });
      return;
    }

    if (!comment || comment.trim().length === 0) {
      logger.debug('Skipping sentiment analysis — empty comment', { reviewId });
      return;
    }

    try {
      const result = await llm.analyzeSentiment(comment);

      await embeddingRepository.updateReviewSentiment(reviewId, result.sentiment, result.score);

      logger.info('Review sentiment analyzed', {
        reviewId,
        sentiment: result.sentiment,
        score: result.score,
      });
    } catch (err: unknown) {
      logger.error('Failed to analyze review sentiment', { reviewId, error: err });
      // Non-fatal — don't throw, the review itself is already saved
    }
  },

  /**
   * Returns an aggregated sentiment summary for a business.
   * @param businessId - The business UUID.
   * @returns Sentiment breakdown with counts and percentages.
   */
  async getBusinessSentimentSummary(businessId: string) {
    logger.debug('sentimentService.getBusinessSentimentSummary', { businessId });

    const { rows } = await pgPool.query(
      `SELECT
        sentiment,
        COUNT(*)::int AS count,
        ROUND(AVG(sentiment_score), 2) AS avg_score
       FROM reviews
       WHERE business_id = $1
         AND sentiment IS NOT NULL
         AND is_published = true
       GROUP BY sentiment
       ORDER BY count DESC`,
      [businessId],
    );

    const totalResult = await pgPool.query(
      `SELECT COUNT(*)::int AS total
       FROM reviews
       WHERE business_id = $1
         AND sentiment IS NOT NULL
         AND is_published = true`,
      [businessId],
    );

    const total = totalResult.rows[0]?.total || 0;

    const breakdown = rows.map((r: Record<string, unknown>) => ({
      sentiment: r.sentiment as string,
      count: r.count as number,
      avgScore: parseFloat(r.avg_score as string),
      percentage: total > 0 ? Math.round(((r.count as number) / total) * 100) : 0,
    }));

    return {
      total,
      breakdown,
    };
  },

  /**
   * Batch-analyzes all reviews that don't have sentiment yet.
   * @returns Number of reviews analyzed.
   */
  async analyzeAllPending(): Promise<number> {
    if (!isOllamaAvailable()) {
      logger.warn('Skipping batch sentiment analysis — Ollama unavailable');
      return 0;
    }

    const { rows } = await pgPool.query(
      `SELECT id, comment
       FROM reviews
       WHERE sentiment IS NULL
         AND comment IS NOT NULL
         AND comment != ''
       ORDER BY created_at`,
    );

    logger.info(`Analyzing sentiment for ${rows.length} reviews`);
    let analyzed = 0;

    for (const row of rows) {
      try {
        const result = await llm.analyzeSentiment(row.comment);
        await embeddingRepository.updateReviewSentiment(row.id, result.sentiment, result.score);
        analyzed++;

        if (analyzed % 10 === 0) {
          logger.info(`Sentiment progress: ${analyzed}/${rows.length}`);
        }
      } catch (err: unknown) {
        logger.error('Failed to analyze review', { reviewId: row.id, error: err });
      }
    }

    logger.info('Batch sentiment analysis complete', { analyzed, total: rows.length });
    return analyzed;
  },
};
