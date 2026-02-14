import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Booking repository — PostgreSQL data access for the bookings table.
 */
export const bookingRepository = {
  async findById(id: string) {
    logger.debug('bookingRepository.findById', { id });
    const { rows } = await pgPool.query('SELECT * FROM bookings WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /** Find booking with joined business name, service name, and slot times */
  async findByIdWithDetails(id: string) {
    logger.debug('bookingRepository.findByIdWithDetails', { id });
    const { rows } = await pgPool.query(
      `SELECT b.*,
              biz.name AS business_name, biz.slug AS business_slug,
              sv.name AS service_name, sv.duration AS service_duration
       FROM bookings b
       LEFT JOIN businesses biz ON b.business_id = biz.id
       LEFT JOIN services sv ON b.service_id = sv.id
       WHERE b.id = $1`,
      [id],
    );
    return rows[0] || null;
  },

  async findByUserId(
    userId: string,
    page: number,
    limit: number,
    filters?: { status?: string; startDate?: string; endDate?: string },
  ) {
    logger.debug('bookingRepository.findByUserId', { userId, page, limit });

    const conditions: string[] = ['b.customer_id = $1'];
    const values: unknown[] = [userId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`b.status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }
    if (filters?.startDate) {
      conditions.push(`b.booking_date >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      conditions.push(`b.booking_date <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pgPool.query(
      `SELECT COUNT(*) FROM bookings b ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const { rows } = await pgPool.query(
      `SELECT b.*,
              biz.name AS business_name, biz.slug AS business_slug,
              sv.name AS service_name, sv.duration AS service_duration
       FROM bookings b
       LEFT JOIN businesses biz ON b.business_id = biz.id
       LEFT JOIN services sv ON b.service_id = sv.id
       ${whereClause}
       ORDER BY b.start_time DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values,
    );

    return { data: rows, total, page, limit };
  },

  async findByBusinessId(
    businessId: string,
    page: number,
    limit: number,
    filters?: { status?: string; startDate?: string; endDate?: string },
  ) {
    logger.debug('bookingRepository.findByBusinessId', { businessId, page, limit });

    const conditions: string[] = ['b.business_id = $1'];
    const values: unknown[] = [businessId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`b.status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }
    if (filters?.startDate) {
      conditions.push(`b.booking_date >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      conditions.push(`b.booking_date <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pgPool.query(
      `SELECT COUNT(*) FROM bookings b ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const { rows } = await pgPool.query(
      `SELECT b.*,
              u.first_name AS customer_first_name, u.last_name AS customer_last_name,
              sv.name AS service_name, sv.duration AS service_duration
       FROM bookings b
       LEFT JOIN users u ON b.customer_id = u.id
       LEFT JOIN services sv ON b.service_id = sv.id
       ${whereClause}
       ORDER BY b.start_time DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values,
    );

    return { data: rows, total, page, limit };
  },

  /** Find all bookings for businesses owned by a given user AND bookings they made as a customer */
  async findByOwnerId(
    ownerId: string,
    page: number,
    limit: number,
    filters?: { status?: string; startDate?: string; endDate?: string },
  ) {
    logger.debug('bookingRepository.findByOwnerId', { ownerId, page, limit });

    // Owner sees both: bookings at their businesses + their own bookings as a customer
    const conditions: string[] = ['(biz.owner_id = $1 OR b.customer_id = $1)'];
    const values: unknown[] = [ownerId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`b.status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }
    if (filters?.startDate) {
      conditions.push(`b.booking_date >= $${paramIndex}`);
      values.push(filters.startDate);
      paramIndex++;
    }
    if (filters?.endDate) {
      conditions.push(`b.booking_date <= $${paramIndex}`);
      values.push(filters.endDate);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pgPool.query(
      `SELECT COUNT(*)
       FROM bookings b
       LEFT JOIN businesses biz ON b.business_id = biz.id
       ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const { rows } = await pgPool.query(
      `SELECT b.*,
              biz.name AS business_name, biz.slug AS business_slug,
              u.first_name AS customer_first_name, u.last_name AS customer_last_name,
              sv.name AS service_name, sv.duration AS service_duration
       FROM bookings b
       LEFT JOIN businesses biz ON b.business_id = biz.id
       LEFT JOIN users u ON b.customer_id = u.id
       LEFT JOIN services sv ON b.service_id = sv.id
       ${whereClause}
       ORDER BY b.start_time DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values,
    );

    return { data: rows, total, page, limit };
  },

  async create(
    data: {
      slotId: string;
      businessId: string;
      customerId: string;
      serviceId?: string;
      bookingDate: string;
      startTime: string;
      endTime: string;
      numberOfPeople: number;
      totalPrice: number;
      customerName: string;
      customerEmail: string;
      customerPhone?: string;
      notes?: string;
    },
    client?: import('pg').PoolClient,
  ) {
    logger.debug('bookingRepository.create', { slotId: data.slotId, customerId: data.customerId });
    const queryRunner = client || pgPool;
    const { rows } = await queryRunner.query(
      `INSERT INTO bookings (
        slot_id, business_id, customer_id, service_id,
        booking_date, start_time, end_time,
        number_of_people, total_price,
        customer_name, customer_email, customer_phone, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.slotId,
        data.businessId,
        data.customerId,
        data.serviceId || null,
        data.bookingDate,
        data.startTime,
        data.endTime,
        data.numberOfPeople,
        data.totalPrice,
        data.customerName,
        data.customerEmail,
        data.customerPhone || null,
        data.notes || null,
      ],
    );
    return rows[0];
  },

  async updateStatus(id: string, status: string, extra?: Record<string, unknown>) {
    logger.debug('bookingRepository.updateStatus', { id, status });

    const setClauses = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values: unknown[] = [status];
    let paramIndex = 2;

    // Status-specific timestamp columns
    if (status === 'confirmed') {
      setClauses.push(`confirmed_at = CURRENT_TIMESTAMP`);
    } else if (status === 'cancelled') {
      setClauses.push(`cancelled_at = CURRENT_TIMESTAMP`);
      if (extra?.cancelledBy) {
        setClauses.push(`cancelled_by = $${paramIndex}`);
        values.push(extra.cancelledBy);
        paramIndex++;
      }
      if (extra?.cancellationReason) {
        setClauses.push(`cancellation_reason = $${paramIndex}`);
        values.push(extra.cancellationReason);
        paramIndex++;
      }
    } else if (status === 'completed') {
      setClauses.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    values.push(id);
    const { rows } = await pgPool.query(
      `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async update(id: string, data: Record<string, unknown>) {
    logger.debug('bookingRepository.update', { id });

    const fieldMap: Record<string, string> = {
      notes: 'notes',
      numberOfPeople: 'number_of_people',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, column] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        setClauses.push(`${column} = $${paramIndex}`);
        values.push(data[key]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const { rows } = await pgPool.query(
      `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return rows[0] || null;
  },
};
