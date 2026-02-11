import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Slot repository — PostgreSQL data access for the slots table.
 */
export const slotRepository = {
  async findById(id: string) {
    logger.debug('slotRepository.findById', { id });
    const { rows } = await pgPool.query('SELECT * FROM slots WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByIdWithService(id: string) {
    logger.debug('slotRepository.findByIdWithService', { id });
    const { rows } = await pgPool.query(
      `SELECT s.*, sv.name AS service_name, sv.duration AS service_duration
       FROM slots s
       LEFT JOIN services sv ON s.service_id = sv.id
       WHERE s.id = $1`,
      [id],
    );
    return rows[0] || null;
  },

  async findAvailable(filters: {
    businessId: string;
    serviceId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }) {
    logger.debug('slotRepository.findAvailable', { filters });

    const conditions: string[] = [
      's.business_id = $1',
      's.is_available = true',
      's.booked_count < s.capacity',
      's.start_time > NOW()',
    ];
    const values: unknown[] = [filters.businessId];
    let paramIndex = 2;

    if (filters.serviceId) {
      conditions.push(`s.service_id = $${paramIndex}`);
      values.push(filters.serviceId);
      paramIndex++;
    }

    if (filters.date) {
      conditions.push(`s.start_time::date = $${paramIndex}`);
      values.push(filters.date);
      paramIndex++;
    } else {
      if (filters.startDate) {
        conditions.push(`s.start_time::date >= $${paramIndex}`);
        values.push(filters.startDate);
        paramIndex++;
      }
      if (filters.endDate) {
        conditions.push(`s.start_time::date <= $${paramIndex}`);
        values.push(filters.endDate);
        paramIndex++;
      }
    }

    const { rows } = await pgPool.query(
      `SELECT s.*, sv.name AS service_name, sv.duration AS service_duration
       FROM slots s
       LEFT JOIN services sv ON s.service_id = sv.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.start_time ASC`,
      values,
    );
    return rows;
  },

  async findByBusinessId(
    businessId: string,
    page: number,
    limit: number,
    filters?: { serviceId?: string; date?: string; isAvailable?: boolean },
  ) {
    logger.debug('slotRepository.findByBusinessId', { businessId, page, limit });

    const conditions: string[] = ['s.business_id = $1'];
    const values: unknown[] = [businessId];
    let paramIndex = 2;

    if (filters?.serviceId) {
      conditions.push(`s.service_id = $${paramIndex}`);
      values.push(filters.serviceId);
      paramIndex++;
    }
    if (filters?.date) {
      conditions.push(`s.start_time::date = $${paramIndex}`);
      values.push(filters.date);
      paramIndex++;
    }
    if (filters?.isAvailable !== undefined) {
      conditions.push(`s.is_available = $${paramIndex}`);
      values.push(filters.isAvailable);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total count
    const countResult = await pgPool.query(
      `SELECT COUNT(*) FROM slots s ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Paginated results
    const offset = (page - 1) * limit;
    values.push(limit, offset);
    const { rows } = await pgPool.query(
      `SELECT s.*, sv.name AS service_name, sv.duration AS service_duration
       FROM slots s
       LEFT JOIN services sv ON s.service_id = sv.id
       ${whereClause}
       ORDER BY s.start_time ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values,
    );

    return { data: rows, total, page, limit };
  },

  async create(data: {
    businessId: string;
    serviceId: string;
    startTime: string;
    endTime: string;
    capacity?: number;
    price: number;
    notes?: string;
  }) {
    logger.debug('slotRepository.create', { businessId: data.businessId });
    const { rows } = await pgPool.query(
      `INSERT INTO slots (business_id, service_id, start_time, end_time, capacity, price, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.businessId,
        data.serviceId,
        data.startTime,
        data.endTime,
        data.capacity ?? 1,
        data.price,
        data.notes || null,
      ],
    );
    return rows[0];
  },

  async bulkCreate(slots: {
    businessId: string;
    serviceId: string;
    startTime: string;
    endTime: string;
    capacity: number;
    price: number;
  }[]) {
    logger.debug('slotRepository.bulkCreate', { count: slots.length });

    if (slots.length === 0) return [];

    // Build batch INSERT with multiple value rows
    const valuePlaceholders: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const slot of slots) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`,
      );
      values.push(
        slot.businessId,
        slot.serviceId,
        slot.startTime,
        slot.endTime,
        slot.capacity,
        slot.price,
      );
      paramIndex += 6;
    }

    const { rows } = await pgPool.query(
      `INSERT INTO slots (business_id, service_id, start_time, end_time, capacity, price)
       VALUES ${valuePlaceholders.join(', ')}
       RETURNING *`,
      values,
    );
    return rows;
  },

  async update(id: string, data: Record<string, unknown>) {
    logger.debug('slotRepository.update', { id });

    const fieldMap: Record<string, string> = {
      startTime: 'start_time',
      endTime: 'end_time',
      capacity: 'capacity',
      price: 'price',
      isAvailable: 'is_available',
      notes: 'notes',
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
      `UPDATE slots SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async updateStatus(id: string, status: string) {
    logger.debug('slotRepository.updateStatus', { id, status });
    const isAvailable = status === 'available';
    const { rows } = await pgPool.query(
      `UPDATE slots SET is_available = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [isAvailable, id],
    );
    return rows[0] || null;
  },

  async delete(id: string) {
    logger.debug('slotRepository.delete', { id });
    const { rowCount } = await pgPool.query('DELETE FROM slots WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  async deleteByBusinessAndDateRange(businessId: string, startDate: string, endDate: string) {
    logger.debug('slotRepository.deleteByBusinessAndDateRange', { businessId, startDate, endDate });
    const { rowCount } = await pgPool.query(
      `DELETE FROM slots
       WHERE business_id = $1
         AND start_time::date >= $2
         AND start_time::date <= $3
         AND booked_count = 0`,
      [businessId, startDate, endDate],
    );
    return rowCount ?? 0;
  },

  /**
   * Atomically increment booked_count and mark unavailable when full.
   * Uses SELECT ... FOR UPDATE to prevent double-booking.
   * Returns the updated slot row, or null if the slot is no longer available.
   */
  async incrementBookedCount(id: string, count: number = 1, client?: import('pg').PoolClient) {
    logger.debug('slotRepository.incrementBookedCount', { id, count });
    const queryRunner = client || pgPool;
    const { rows } = await queryRunner.query(
      `UPDATE slots
       SET booked_count = booked_count + $1,
           is_available = CASE WHEN (booked_count + $1) >= capacity THEN false ELSE true END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND is_available = true
         AND (booked_count + $1) <= capacity
       RETURNING *`,
      [count, id],
    );
    return rows[0] || null;
  },

  /**
   * Atomically decrement booked_count and re-open the slot.
   */
  async decrementBookedCount(id: string, count: number = 1) {
    logger.debug('slotRepository.decrementBookedCount', { id, count });
    const { rows } = await pgPool.query(
      `UPDATE slots
       SET booked_count = GREATEST(booked_count - $1, 0),
           is_available = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [count, id],
    );
    return rows[0] || null;
  },

  /**
   * Lock a slot row for update within a transaction (prevents double-booking).
   */
  async findByIdForUpdate(id: string, client: import('pg').PoolClient) {
    logger.debug('slotRepository.findByIdForUpdate', { id });
    const { rows } = await client.query(
      'SELECT * FROM slots WHERE id = $1 FOR UPDATE',
      [id],
    );
    return rows[0] || null;
  },
};
