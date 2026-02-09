import { pgPool } from '../../config';
import { logger } from '../../libs';

/**
 * User repository — PostgreSQL data access for the users table.
 */
export const userRepository = {
  async findByEmail(email: string) {
    // TODO: Implement in Sprint 2
    logger.debug('userRepository.findByEmail', { email });
    const { rows } = await pgPool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id: string) {
    // TODO: Implement in Sprint 2
    logger.debug('userRepository.findById', { id });
    const { rows } = await pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: string;
  }) {
    // TODO: Implement in Sprint 2
    logger.debug('userRepository.create', { email: data.email });
    const { rows } = await pgPool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [data.email, data.passwordHash, data.firstName, data.lastName, data.phone, data.role],
    );
    return rows[0];
  },

  async update(id: string, data: Record<string, unknown>) {
    // TODO: Implement in Sprint 3
    logger.debug('userRepository.update', { id });
    throw new Error('Not implemented');
  },

  async delete(id: string) {
    // TODO: Implement in Sprint 8
    logger.debug('userRepository.delete', { id });
    throw new Error('Not implemented');
  },

  async findAll(page: number, limit: number) {
    // TODO: Implement in Sprint 8
    logger.debug('userRepository.findAll', { page, limit });
    throw new Error('Not implemented');
  },

  async updateLastLogin(id: string) {
    // TODO: Implement in Sprint 2
    logger.debug('userRepository.updateLastLogin', { id });
    await pgPool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
  },
};
