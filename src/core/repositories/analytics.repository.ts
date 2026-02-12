import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Analytics repository — raw SQL queries for business metrics aggregation.
 * All queries are parameterized and operate on PostgreSQL.
 */
export const analyticsRepository = {
  /**
   * Get booking counts grouped by status for a business within a date range.
   */
  async getBookingCountsByStatus(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getBookingCountsByStatus', {
      businessId,
      startDate,
      endDate,
    });
    const { rows } = await pgPool.query(
      `SELECT
         status,
         COUNT(*)::int AS count
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date
       GROUP BY status`,
      [businessId, startDate, endDate],
    );
    return rows as { status: string; count: number }[];
  },

  /**
   * Get total revenue and booking count for a business within a date range.
   */
  async getRevenueSummary(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getRevenueSummary', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         COUNT(*)::int AS total_bookings,
         COALESCE(SUM(total_price), 0)::numeric AS total_revenue,
         COALESCE(AVG(total_price), 0)::numeric AS avg_booking_value
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date
         AND status IN ('confirmed', 'completed')`,
      [businessId, startDate, endDate],
    );
    return rows[0] as {
      total_bookings: number;
      total_revenue: number;
      avg_booking_value: number;
    };
  },

  /**
   * Get daily revenue and booking counts for a trend chart.
   */
  async getDailyRevenueTrend(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getDailyRevenueTrend', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         booking_date::text AS date,
         COUNT(*)::int AS bookings,
         COALESCE(SUM(total_price), 0)::numeric AS revenue
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date
         AND status IN ('confirmed', 'completed')
       GROUP BY booking_date
       ORDER BY booking_date ASC`,
      [businessId, startDate, endDate],
    );
    return rows as { date: string; bookings: number; revenue: number }[];
  },

  /**
   * Get monthly revenue and booking counts for a longer-term trend.
   */
  async getMonthlyRevenueTrend(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getMonthlyRevenueTrend', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         TO_CHAR(booking_date, 'YYYY-MM') AS month,
         COUNT(*)::int AS bookings,
         COALESCE(SUM(total_price), 0)::numeric AS revenue
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date
         AND status IN ('confirmed', 'completed')
       GROUP BY TO_CHAR(booking_date, 'YYYY-MM')
       ORDER BY month ASC`,
      [businessId, startDate, endDate],
    );
    return rows as { month: string; bookings: number; revenue: number }[];
  },

  /**
   * Get top services by booking count and revenue.
   */
  async getTopServices(businessId: string, startDate: string, endDate: string, limit = 10) {
    logger.debug('analyticsRepository.getTopServices', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         s.id AS service_id,
         s.name AS service_name,
         COUNT(b.id)::int AS booking_count,
         COALESCE(SUM(b.total_price), 0)::numeric AS revenue
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.business_id = $1
         AND b.booking_date >= $2::date
         AND b.booking_date <= $3::date
         AND b.status IN ('confirmed', 'completed')
       GROUP BY s.id, s.name
       ORDER BY booking_count DESC
       LIMIT $4`,
      [businessId, startDate, endDate, limit],
    );
    return rows as {
      service_id: string;
      service_name: string;
      booking_count: number;
      revenue: number;
    }[];
  },

  /**
   * Get peak booking hours (hour of day distribution).
   */
  async getPeakHours(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getPeakHours', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         EXTRACT(HOUR FROM start_time)::int AS hour,
         COUNT(*)::int AS count
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date
         AND status IN ('confirmed', 'completed')
       GROUP BY EXTRACT(HOUR FROM start_time)
       ORDER BY hour ASC`,
      [businessId, startDate, endDate],
    );
    return rows as { hour: number; count: number }[];
  },

  /**
   * Get unique customer count and new vs returning breakdown.
   */
  async getCustomerMetrics(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getCustomerMetrics', { businessId, startDate, endDate });

    // Total unique customers in period
    const {
      rows: [totalRow],
    } = await pgPool.query(
      `SELECT COUNT(DISTINCT customer_id)::int AS unique_customers
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date`,
      [businessId, startDate, endDate],
    );

    // New customers: first booking ever at this business is within the period
    const {
      rows: [newRow],
    } = await pgPool.query(
      `SELECT COUNT(*)::int AS new_customers
       FROM (
         SELECT customer_id, MIN(booking_date) AS first_booking
         FROM bookings
         WHERE business_id = $1
         GROUP BY customer_id
         HAVING MIN(booking_date) >= $2::date AND MIN(booking_date) <= $3::date
       ) sub`,
      [businessId, startDate, endDate],
    );

    const unique = totalRow?.unique_customers ?? 0;
    const newCust = newRow?.new_customers ?? 0;

    return {
      totalCustomers: unique,
      newCustomers: newCust,
      returningCustomers: Math.max(0, unique - newCust),
    };
  },

  /**
   * Get review stats for a business within a date range.
   */
  async getReviewStats(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getReviewStats', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         COUNT(*)::int AS total_reviews,
         COALESCE(AVG(rating), 0)::numeric AS average_rating,
         COUNT(*) FILTER (WHERE rating = 5)::int AS five_star,
         COUNT(*) FILTER (WHERE rating = 4)::int AS four_star,
         COUNT(*) FILTER (WHERE rating = 3)::int AS three_star,
         COUNT(*) FILTER (WHERE rating = 2)::int AS two_star,
         COUNT(*) FILTER (WHERE rating = 1)::int AS one_star
       FROM reviews
       WHERE business_id = $1
         AND is_published = true
         AND created_at >= $2::date
         AND created_at <= ($3::date + interval '1 day')`,
      [businessId, startDate, endDate],
    );
    return rows[0] as {
      total_reviews: number;
      average_rating: number;
      five_star: number;
      four_star: number;
      three_star: number;
      two_star: number;
      one_star: number;
    };
  },

  /**
   * Get recent bookings for a business (latest N).
   */
  async getRecentBookings(businessId: string, limit = 10) {
    logger.debug('analyticsRepository.getRecentBookings', { businessId, limit });
    const { rows } = await pgPool.query(
      `SELECT
         b.id, b.customer_name, b.customer_email, b.status,
         b.booking_date::text, b.start_time, b.end_time,
         b.total_price, b.number_of_people, b.created_at,
         s.name AS service_name
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.business_id = $1
       ORDER BY b.created_at DESC
       LIMIT $2`,
      [businessId, limit],
    );
    return rows;
  },

  /**
   * Get slot occupancy rate for a business.
   */
  async getOccupancyRate(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getOccupancyRate', { businessId, startDate, endDate });
    const {
      rows: [row],
    } = await pgPool.query(
      `SELECT
         COUNT(*)::int AS total_slots,
         COUNT(*) FILTER (WHERE booked_count > 0)::int AS booked_slots
       FROM slots
       WHERE business_id = $1
         AND start_time >= $2::date
         AND start_time <= ($3::date + interval '1 day')`,
      [businessId, startDate, endDate],
    );
    const total = row?.total_slots ?? 0;
    const booked = row?.booked_slots ?? 0;
    return {
      totalSlots: total,
      bookedSlots: booked,
      occupancyRate: total > 0 ? Math.round((booked / total) * 100) : 0,
    };
  },

  /**
   * Get booking count by day of week.
   */
  async getBookingsByDayOfWeek(businessId: string, startDate: string, endDate: string) {
    logger.debug('analyticsRepository.getBookingsByDayOfWeek', { businessId, startDate, endDate });
    const { rows } = await pgPool.query(
      `SELECT
         EXTRACT(DOW FROM booking_date)::int AS day_of_week,
         COUNT(*)::int AS count
       FROM bookings
       WHERE business_id = $1
         AND booking_date >= $2::date
         AND booking_date <= $3::date
         AND status IN ('confirmed', 'completed')
       GROUP BY EXTRACT(DOW FROM booking_date)
       ORDER BY day_of_week ASC`,
      [businessId, startDate, endDate],
    );
    return rows as { day_of_week: number; count: number }[];
  },
};
