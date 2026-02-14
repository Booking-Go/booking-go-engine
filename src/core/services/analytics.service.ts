import { analyticsRepository } from '../repositories/analytics.repository';
import { businessRepository } from '../repositories/business.repository';
import { cache, logger } from '../../libs';
import { CacheKeys, CacheTTL } from '../constants';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus } from '../constants';

/**
 * Date helper — returns ISO date string for N days ago.
 */
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

/**
 * Date helper — returns ISO date string for N days from now.
 * Booking platforms need to include upcoming scheduled appointments.
 */
const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

/**
 * Period presets mapped to { startDate, endDate }.
 * endDate extends into the future to capture upcoming bookings,
 * since appointments are typically scheduled ahead of time.
 */
const periodToRange = (period: string): { startDate: string; endDate: string } => {
  switch (period) {
    case '7d':
      return { startDate: daysAgo(7), endDate: daysFromNow(30) };
    case '30d':
      return { startDate: daysAgo(30), endDate: daysFromNow(30) };
    case '90d':
      return { startDate: daysAgo(90), endDate: daysFromNow(30) };
    case '365d':
      return { startDate: daysAgo(365), endDate: daysFromNow(30) };
    case 'all':
      return { startDate: '2020-01-01', endDate: daysFromNow(365) };
    default:
      return { startDate: daysAgo(30), endDate: daysFromNow(30) };
  }
};

/**
 * Analytics service — aggregates comprehensive business metrics.
 */
export const analyticsService = {
  /**
   * Verify the caller owns the business (or is admin).
   */
  async verifyOwnership(businessId: string, userId: string, role: string) {
    if (role === 'admin') return;
    const business = await businessRepository.findById(businessId);
    if (!business) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    }
    if (business.owner_id !== userId) {
      throw new AppError('You do not own this business', HttpStatus.FORBIDDEN);
    }
  },

  /**
   * Get comprehensive dashboard analytics for a business.
   *
   * @param businessId - The business UUID
   * @param userId - The requesting user's UUID
   * @param role - The requesting user's role
   * @param period - Time range preset: '7d', '30d', '90d', '365d', 'all'
   * @returns Full analytics payload
   */
  async getBusinessAnalytics(
    businessId: string,
    userId: string,
    role: string,
    period = '30d',
    customStartDate?: string,
    customEndDate?: string,
  ) {
    logger.debug('analyticsService.getBusinessAnalytics', {
      businessId,
      period,
      customStartDate,
      customEndDate,
    });

    await this.verifyOwnership(businessId, userId, role);

    // Use custom date range when provided, otherwise fall back to period preset
    const { startDate, endDate } =
      customStartDate && customEndDate
        ? { startDate: customStartDate, endDate: customEndDate }
        : periodToRange(period);

    // Check cache — include date range in key for custom ranges
    const rangeKey =
      customStartDate && customEndDate ? `${customStartDate}_${customEndDate}` : period;
    const cacheKey = `${CacheKeys.businessAnalytics(businessId)}:${rangeKey}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    // Run all queries in parallel
    const [
      statusCounts,
      revenueSummary,
      dailyTrend,
      topServices,
      peakHours,
      customerMetrics,
      reviewStats,
      occupancy,
      bookingsByDay,
      recentBookings,
    ] = await Promise.all([
      analyticsRepository.getBookingCountsByStatus(businessId, startDate, endDate),
      analyticsRepository.getRevenueSummary(businessId, startDate, endDate),
      analyticsRepository.getDailyRevenueTrend(businessId, startDate, endDate),
      analyticsRepository.getTopServices(businessId, startDate, endDate),
      analyticsRepository.getPeakHours(businessId, startDate, endDate),
      analyticsRepository.getCustomerMetrics(businessId, startDate, endDate),
      analyticsRepository.getReviewStats(businessId, startDate, endDate),
      analyticsRepository.getOccupancyRate(businessId, startDate, endDate),
      analyticsRepository.getBookingsByDayOfWeek(businessId, startDate, endDate),
      analyticsRepository.getRecentBookings(businessId, 10),
    ]);

    // Build status map
    const statusMap: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
    }
    const totalBookings = Object.values(statusMap).reduce((a, b) => a + b, 0);

    // Build peak hours array (0-23)
    const peakHoursMap = new Array(24).fill(0) as number[];
    for (const row of peakHours) {
      peakHoursMap[row.hour] = row.count;
    }

    // Build day of week map (0=Sun..6=Sat)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const bookingsByDayMap = dayNames.map((name, i) => ({
      day: name,
      count: bookingsByDay.find((d) => d.day_of_week === i)?.count ?? 0,
    }));

    // Cancellation rate
    const cancellationRate =
      totalBookings > 0 ? Math.round((statusMap.cancelled / totalBookings) * 100) : 0;

    // Completion rate
    const completionRate =
      totalBookings > 0 ? Math.round((statusMap.completed / totalBookings) * 100) : 0;

    // Compare with previous period for growth calculation
    const dayCount = Math.max(
      1,
      Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000),
    );
    const prevStart = daysAgo(dayCount * 2);
    const prevEnd = startDate;

    const prevRevenue = await analyticsRepository.getRevenueSummary(businessId, prevStart, prevEnd);
    const currentRev = Number(revenueSummary.total_revenue);
    const previousRev = Number(prevRevenue.total_revenue);
    const revenueGrowth =
      previousRev > 0
        ? Math.round(((currentRev - previousRev) / previousRev) * 100)
        : currentRev > 0
          ? 100
          : 0;

    const currentBookings = revenueSummary.total_bookings;
    const previousBookings = prevRevenue.total_bookings;
    const bookingGrowth =
      previousBookings > 0
        ? Math.round(((currentBookings - previousBookings) / previousBookings) * 100)
        : currentBookings > 0
          ? 100
          : 0;

    const result = {
      period: { startDate, endDate, label: period },
      overview: {
        totalBookings,
        totalRevenue: Number(currentRev.toFixed(2)),
        avgBookingValue: Number(Number(revenueSummary.avg_booking_value).toFixed(2)),
        occupancyRate: occupancy.occupancyRate,
        cancellationRate,
        completionRate,
        revenueGrowth,
        bookingGrowth,
      },
      bookingsByStatus: statusMap,
      revenue: {
        daily: dailyTrend.map((d) => ({
          date: d.date,
          bookings: d.bookings,
          revenue: Number(Number(d.revenue).toFixed(2)),
        })),
      },
      topServices: topServices.map((s) => ({
        serviceId: s.service_id,
        serviceName: s.service_name,
        bookingCount: s.booking_count,
        revenue: Number(Number(s.revenue).toFixed(2)),
      })),
      peakHours: peakHoursMap,
      bookingsByDayOfWeek: bookingsByDayMap,
      customers: customerMetrics,
      reviews: {
        totalReviews: reviewStats.total_reviews,
        averageRating: Number(Number(reviewStats.average_rating).toFixed(1)),
        distribution: {
          5: reviewStats.five_star,
          4: reviewStats.four_star,
          3: reviewStats.three_star,
          2: reviewStats.two_star,
          1: reviewStats.one_star,
        },
      },
      slots: occupancy,
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        customerName: b.customer_name,
        serviceName: b.service_name,
        status: b.status,
        bookingDate: b.booking_date,
        totalPrice: Number(b.total_price),
        createdAt: b.created_at,
      })),
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, CacheTTL.BUSINESS_ANALYTICS);

    return result;
  },

  /**
   * Get a revenue report for export/download.
   */
  async getRevenueReport(
    businessId: string,
    userId: string,
    role: string,
    startDate: string,
    endDate: string,
  ) {
    logger.debug('analyticsService.getRevenueReport', { businessId, startDate, endDate });

    await this.verifyOwnership(businessId, userId, role);

    const [daily, monthly, topServices, revenueSummary] = await Promise.all([
      analyticsRepository.getDailyRevenueTrend(businessId, startDate, endDate),
      analyticsRepository.getMonthlyRevenueTrend(businessId, startDate, endDate),
      analyticsRepository.getTopServices(businessId, startDate, endDate, 20),
      analyticsRepository.getRevenueSummary(businessId, startDate, endDate),
    ]);

    return {
      period: { startDate, endDate },
      summary: {
        totalBookings: revenueSummary.total_bookings,
        totalRevenue: Number(Number(revenueSummary.total_revenue).toFixed(2)),
        avgBookingValue: Number(Number(revenueSummary.avg_booking_value).toFixed(2)),
      },
      daily: daily.map((d) => ({
        date: d.date,
        bookings: d.bookings,
        revenue: Number(Number(d.revenue).toFixed(2)),
      })),
      monthly: monthly.map((m) => ({
        month: m.month,
        bookings: m.bookings,
        revenue: Number(Number(m.revenue).toFixed(2)),
      })),
      serviceBreakdown: topServices.map((s) => ({
        serviceName: s.service_name,
        bookingCount: s.booking_count,
        revenue: Number(Number(s.revenue).toFixed(2)),
      })),
    };
  },
};
