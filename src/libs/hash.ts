import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Password hashing and comparison utilities using bcrypt.
 */
export const hash = {
  /**
   * Hash a plain-text password.
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  /**
   * Compare a plain-text password against a stored hash.
   */
  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  },
};
