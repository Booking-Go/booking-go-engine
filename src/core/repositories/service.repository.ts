import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * Service repository — PostgreSQL data access for the services table.
 */
export const serviceRepository = {
  async findById(id: string) {
    logger.debug('serviceRepository.findById', { id });
    const { rows } = await pgPool.query('SELECT * FROM services WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async findByBusinessId(businessId: string) {
    logger.debug('serviceRepository.findByBusinessId', { businessId });
    const { rows } = await pgPool.query(
      'SELECT * FROM services WHERE business_id = $1 ORDER BY display_order ASC, created_at ASC',
      [businessId],
    );
    return rows;
  },

  async create(data: {
    businessId: string;
    name: string;
    description?: string;
    duration: number;
    price: number;
    depositAmount?: number;
    maxCapacity?: number;
    bufferTime?: number;
    imageUrl?: string;
    displayOrder?: number;
    isActive?: boolean;
  }) {
    logger.debug('serviceRepository.create', { businessId: data.businessId, name: data.name });
    const { rows } = await pgPool.query(
      `INSERT INTO services (business_id, name, description, duration, price, deposit_amount, max_capacity, buffer_time, image_url, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        data.businessId,
        data.name,
        data.description || null,
        data.duration,
        data.price,
        data.depositAmount ?? 0,
        data.maxCapacity ?? 1,
        data.bufferTime ?? 0,
        data.imageUrl || null,
        data.displayOrder ?? 0,
        data.isActive ?? true,
      ],
    );
    return rows[0];
  },

  async update(id: string, data: Record<string, unknown>) {
    logger.debug('serviceRepository.update', { id });

    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      duration: 'duration',
      price: 'price',
      depositAmount: 'deposit_amount',
      maxCapacity: 'max_capacity',
      bufferTime: 'buffer_time',
      imageUrl: 'image_url',
      displayOrder: 'display_order',
      isActive: 'is_active',
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

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const { rows } = await pgPool.query(
      `UPDATE services SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async delete(id: string) {
    logger.debug('serviceRepository.delete', { id });
    const { rowCount } = await pgPool.query('DELETE FROM services WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  },

  async countByBusinessId(businessId: string) {
    const { rows } = await pgPool.query(
      'SELECT COUNT(*) FROM services WHERE business_id = $1',
      [businessId],
    );
    return parseInt(rows[0].count, 10);
  },
};
