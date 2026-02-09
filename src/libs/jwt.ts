import jsonwebtoken, { SignOptions } from 'jsonwebtoken';

import { logger } from './logger';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: 'customer' | 'business_owner' | 'admin';
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
}

const getAccessSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not defined');
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not defined');
  return secret;
};

/**
 * JWT utility — sign and verify access & refresh tokens.
 */
export const jwt = {
  /**
   * Sign an access token (short-lived, 15 min default).
   */
  signAccessToken(payload: AccessTokenPayload): string {
    const expiresIn = process.env.JWT_ACCESS_EXPIRY!;
    return jsonwebtoken.sign(payload, getAccessSecret(), { expiresIn } as SignOptions);
  },

  /**
   * Sign a refresh token (long-lived, 30 days default).
   */
  signRefreshToken(payload: RefreshTokenPayload): string {
    const expiresIn = process.env.JWT_REFRESH_EXPIRY!;
    return jsonwebtoken.sign(payload, getRefreshSecret(), { expiresIn } as SignOptions);
  },

  /**
   * Verify and decode an access token.
   */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      return jsonwebtoken.verify(token, getAccessSecret()) as AccessTokenPayload;
    } catch (error) {
      logger.warn('Access token verification failed', { error });
      return null;
    }
  },

  /**
   * Verify and decode a refresh token.
   */
  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      return jsonwebtoken.verify(token, getRefreshSecret()) as RefreshTokenPayload;
    } catch (error) {
      logger.warn('Refresh token verification failed', { error });
      return null;
    }
  },

  /**
   * Generate a random token string for password resets, email verification, etc.
   */
  generateRandomToken(): string {
    const { randomBytes } = require('crypto');
    return randomBytes(32).toString('hex');
  },
};
