import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Business repository — PostgreSQL data access for businesses, business_hours, and business_holidays tables.
 */
export const businessRepository = {
  /** Finds a business by its UUID. Returns `null` if not found. */
  async findById(id: string) {
    logger.debug('businessRepository.findById', { id });
    const { rows } = await pgPool.query('SELECT * FROM businesses WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /** Finds a business by its URL slug. Returns `null` if not found. */
  async findBySlug(slug: string) {
    logger.debug('businessRepository.findBySlug', { slug });
    const { rows } = await pgPool.query('SELECT * FROM businesses WHERE slug = $1', [slug]);
    return rows[0] || null;
  },

  /** Returns all businesses owned by the given user, newest first. */
  async findByOwnerId(ownerId: string) {
    logger.debug('businessRepository.findByOwnerId', { ownerId });
    const { rows } = await pgPool.query(
      'SELECT * FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId],
    );
    return rows;
  },

  /**
   * Paginated business listing with optional filters (category, city, search, etc.).
   * @param filters - Key-value filter criteria.
   * @param page - Page number (1-based).
   * @param limit - Results per page.
   */
  async findAll(filters: Record<string, unknown>, page: number, limit: number) {
    logger.debug('businessRepository.findAll', { filters, page, limit });

    const conditions: string[] = ['is_active = true'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.category) {
      conditions.push(`category = $${paramIndex}`);
      values.push(filters.category);
      paramIndex++;
    }
    if (filters.city) {
      conditions.push(`city = $${paramIndex}`);
      values.push(filters.city);
      paramIndex++;
    }
    if (filters.state) {
      conditions.push(`state = $${paramIndex}`);
      values.push(filters.state);
      paramIndex++;
    }
    if (filters.country) {
      conditions.push(`country = $${paramIndex}`);
      values.push(filters.country);
      paramIndex++;
    }
    if (filters.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await pgPool.query(
      `SELECT COUNT(*) FROM businesses ${whereClause}`,
      values,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    values.push(limit, offset);
    const { rows } = await pgPool.query(
      `SELECT * FROM businesses ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values,
    );

    return { data: rows, total, page, limit };
  },

  /** Inserts a new business record and returns the created row. */
  async create(data: Record<string, unknown>) {
    logger.debug('businessRepository.create', { name: data.name });
    const { rows } = await pgPool.query(
      `INSERT INTO businesses (
        owner_id, name, slug, description, category,
        address_line1, address_line2, city, state, zip_code, country,
        latitude, longitude, phone, email, website,
        logo_url, cover_image_url, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        data.ownerId,
        data.name,
        data.slug,
        data.description || null,
        data.category,
        data.addressLine1,
        data.addressLine2 || null,
        data.city,
        data.state,
        data.zipCode,
        data.country,
        data.latitude || null,
        data.longitude || null,
        data.phone,
        data.email,
        data.website || null,
        data.logoUrl || null,
        data.coverImageUrl || null,
        data.settings ? JSON.stringify(data.settings) : null,
      ],
    );
    return rows[0];
  },

  /** Updates a business by ID. Only provided fields are changed. */
  async update(id: string, data: Record<string, unknown>) {
    logger.debug('businessRepository.update', { id, fields: Object.keys(data) });

    const fieldMap: Record<string, string> = {
      name: 'name',
      slug: 'slug',
      description: 'description',
      category: 'category',
      addressLine1: 'address_line1',
      addressLine2: 'address_line2',
      city: 'city',
      state: 'state',
      zipCode: 'zip_code',
      country: 'country',
      latitude: 'latitude',
      longitude: 'longitude',
      phone: 'phone',
      email: 'email',
      website: 'website',
      logoUrl: 'logo_url',
      coverImageUrl: 'cover_image_url',
      timezone: 'timezone',
      settings: 'settings',
      isActive: 'is_active',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      const column = fieldMap[key];
      if (!column) continue;
      setClauses.push(`${column} = $${paramIndex}`);
      values.push(key === 'settings' ? JSON.stringify(value) : value);
      paramIndex++;
    }

    if (setClauses.length === 0) return this.findById(id);

    values.push(id);
    const { rows } = await pgPool.query(
      `UPDATE businesses SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  /** Deletes a business by ID. Returns `true` if a row was removed. */
  async delete(id: string) {
    logger.debug('businessRepository.delete', { id });
    const { rowCount } = await pgPool.query('DELETE FROM businesses WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  // --- Business Hours ---

  /** Returns all business hours for a business, ordered by day of week. */
  async getBusinessHours(businessId: string) {
    logger.debug('businessRepository.getBusinessHours', { businessId });
    const { rows } = await pgPool.query(
      'SELECT * FROM business_hours WHERE business_id = $1 ORDER BY day_of_week',
      [businessId],
    );
    return rows;
  },

  /** Replaces all business hours for a business within a transaction. */
  async setBusinessHours(businessId: string, hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[]) {
    logger.debug('businessRepository.setBusinessHours', { businessId, count: hours.length });

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing hours for this business
      await client.query('DELETE FROM business_hours WHERE business_id = $1', [businessId]);

      // Insert new hours
      for (const h of hours) {
        await client.query(
          `INSERT INTO business_hours (business_id, day_of_week, open_time, close_time, is_closed)
           VALUES ($1, $2, $3, $4, $5)`,
          [businessId, h.dayOfWeek, h.openTime, h.closeTime, h.isClosed],
        );
      }

      await client.query('COMMIT');
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return this.getBusinessHours(businessId);
  },

  // --- Business Holidays ---

  /** Returns all holidays for a business, ordered by date. */
  async getBusinessHolidays(businessId: string) {
    logger.debug('businessRepository.getBusinessHolidays', { businessId });
    const { rows } = await pgPool.query(
      'SELECT * FROM business_holidays WHERE business_id = $1 ORDER BY holiday_date',
      [businessId],
    );
    return rows;
  },

  /** Adds a holiday date for a business. */
  async addBusinessHoliday(businessId: string, holiday: { date: string; reason?: string }) {
    logger.debug('businessRepository.addBusinessHoliday', { businessId, date: holiday.date });
    const { rows } = await pgPool.query(
      `INSERT INTO business_holidays (business_id, holiday_date, reason)
       VALUES ($1, $2, $3) RETURNING *`,
      [businessId, holiday.date, holiday.reason || null],
    );
    return rows[0];
  },

  /** Removes a holiday by ID for the given business. Returns `true` if deleted. */
  async removeBusinessHoliday(businessId: string, holidayId: string) {
    logger.debug('businessRepository.removeBusinessHoliday', { businessId, holidayId });
    const { rowCount } = await pgPool.query(
      'DELETE FROM business_holidays WHERE id = $1 AND business_id = $2',
      [holidayId, businessId],
    );
    return (rowCount ?? 0) > 0;
  },
};
