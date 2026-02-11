import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Review repository — PostgreSQL data access for the reviews table.
 */
export const reviewRepository = {
  /** Finds a review by its UUID. Returns `null` if not found. */
  async findById(id: string) {
    logger.debug('reviewRepository.findById', { id });
    const { rows } = await pgPool.query('SELECT * FROM reviews WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /**
   * Returns published reviews for a business with customer info, paginated.
   * @param businessId - The business UUID.
   * @param page - Page number (1-based).
   * @param limit - Results per page.
   */
  async findByBusinessId(businessId: string, page: number, limit: number) {
    logger.debug('reviewRepository.findByBusinessId', { businessId, page, limit });
    const offset = (page - 1) * limit;

    const countResult = await pgPool.query(
      'SELECT COUNT(*) FROM reviews WHERE business_id = $1 AND is_published = true',
      [businessId],
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { rows } = await pgPool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.first_name AS customer_first_name,
              u.last_name AS customer_last_name,
              u.profile_image AS customer_profile_image
       FROM reviews r
       JOIN users u ON r.customer_id = u.id
       WHERE r.business_id = $1 AND r.is_published = true
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [businessId, limit, offset],
    );

    return { data: rows, total, page, limit };
  },

  /** Finds a review by its booking ID. Returns `null` if not found. */
  async findByBookingId(bookingId: string) {
    logger.debug('reviewRepository.findByBookingId', { bookingId });
    const { rows } = await pgPool.query('SELECT * FROM reviews WHERE booking_id = $1', [bookingId]);
    return rows[0] || null;
  },

  /** Creates a new review record and returns the inserted row. */
  async create(data: {
    bookingId: string;
    businessId: string;
    customerId: string;
    rating: number;
    comment?: string;
  }) {
    logger.debug('reviewRepository.create', { bookingId: data.bookingId });
    const { rows } = await pgPool.query(
      `INSERT INTO reviews (booking_id, business_id, customer_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.bookingId, data.businessId, data.customerId, data.rating, data.comment || null],
    );
    return rows[0];
  },

  /** Calculates the average rating for a business. Returns 0 if no reviews. */
  async getAverageRating(businessId: string): Promise<{ average: number; count: number }> {
    logger.debug('reviewRepository.getAverageRating', { businessId });
    const { rows } = await pgPool.query(
      `SELECT COALESCE(AVG(rating), 0) AS average, COUNT(*)::int AS count
       FROM reviews
       WHERE business_id = $1 AND is_published = true`,
      [businessId],
    );
    return {
      average: parseFloat(parseFloat(rows[0].average).toFixed(1)),
      count: rows[0].count,
    };
  },
};

