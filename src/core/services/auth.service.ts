import { logger, hash, jwt, cache, email } from '../../libs';
import { AppError } from '../../middleware';
import { HttpStatus, CacheKeys, CacheTTL } from '../constants';
import { userRepository } from '../repositories';

import type { RegisterInput, LoginInput } from '../validators';

/**
 * Strip sensitive fields before returning a user object to the client.
 */
const sanitizeUser = (row: Record<string, unknown>) => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  phone: row.phone,
  role: row.role,
  emailVerified: row.email_verified,
  profileImage: row.profile_image,
  timezone: row.timezone,
  language: row.language,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Auth service — business logic for authentication.
 * Orchestrates: userRepository, hash, jwt, cache, email.
 */
export const authService = {
  async register(input: RegisterInput) {
    // 1. Check if email already exists
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError('Email already registered', HttpStatus.CONFLICT, 'EMAIL_EXISTS');
    }

    // 2. Hash password
    const passwordHash = await hash.hashPassword(input.password);

    // 3. Create user
    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: input.role || 'customer',
    });

    // 4. Generate tokens
    const accessToken = jwt.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = jwt.signRefreshToken({
      userId: user.id,
      type: 'refresh',
    });

    // 5. Store refresh token in Redis
    await cache.set(CacheKeys.refreshToken(user.id), refreshToken, CacheTTL.REFRESH_TOKEN);

    // 6. Send verification email (fire-and-forget)
    const verificationToken = jwt.generateRandomToken();
    email.sendVerification(user.email, verificationToken).catch((err) => {
      logger.warn('Failed to send verification email', { error: err, userId: user.id });
    });

    logger.info('User registered', { userId: user.id, role: user.role });

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  },

  async login(input: LoginInput) {
    // 1. Find user by email
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
      );
    }

    // 2. Check account is active
    if (!user.is_active) {
      throw new AppError('Account is deactivated', HttpStatus.FORBIDDEN, 'ACCOUNT_DEACTIVATED');
    }

    // 3. Verify password
    const isMatch = await hash.comparePassword(input.password, user.password_hash);
    if (!isMatch) {
      throw new AppError(
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
      );
    }

    // 4. Generate tokens
    const accessToken = jwt.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = jwt.signRefreshToken({
      userId: user.id,
      type: 'refresh',
    });

    // 5. Store refresh token in Redis
    await cache.set(CacheKeys.refreshToken(user.id), refreshToken, CacheTTL.REFRESH_TOKEN);

    // 6. Update last login timestamp (fire-and-forget)
    userRepository.updateLastLogin(user.id).catch((err) => {
      logger.warn('Failed to update last login', { error: err, userId: user.id });
    });

    logger.info('User logged in', { userId: user.id });

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  },

  async refreshToken(token: string) {
    // 1. Verify refresh token
    const payload = jwt.verifyRefreshToken(token);
    if (!payload) {
      throw new AppError(
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
        'INVALID_REFRESH_TOKEN',
      );
    }

    // 2. Check token matches what's stored in Redis
    const storedToken = await cache.get<string>(CacheKeys.refreshToken(payload.userId));
    if (!storedToken || storedToken !== token) {
      // Possible token reuse — invalidate all sessions for safety
      await cache.del(CacheKeys.refreshToken(payload.userId));
      throw new AppError(
        'Refresh token has been revoked',
        HttpStatus.UNAUTHORIZED,
        'TOKEN_REVOKED',
      );
    }

    // 3. Find user
    const user = await userRepository.findById(payload.userId);
    if (!user || !user.is_active) {
      throw new AppError(
        'User not found or deactivated',
        HttpStatus.UNAUTHORIZED,
        'USER_NOT_FOUND',
      );
    }

    // 4. Issue new tokens (rotation)
    const newAccessToken = jwt.signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = jwt.signRefreshToken({
      userId: user.id,
      type: 'refresh',
    });

    // 5. Replace old refresh token in Redis
    await cache.set(CacheKeys.refreshToken(user.id), newRefreshToken, CacheTTL.REFRESH_TOKEN);

    logger.info('Token refreshed', { userId: user.id });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  },

  async logout(userId: string) {
    // Remove refresh token from Redis
    await cache.del(CacheKeys.refreshToken(userId));
    logger.info('User logged out', { userId });
  },

  async forgotPassword(emailAddress: string) {
    // 1. Find user by email (don't reveal if email exists)
    const user = await userRepository.findByEmail(emailAddress);

    if (user) {
      // 2. Generate reset token and store as token→userId in Redis (1 hour TTL)
      const resetToken = jwt.generateRandomToken();
      await cache.set(`auth:password-reset:${resetToken}`, user.id, 3600);

      // 3. Send reset email
      await email.sendPasswordReset(user.email, resetToken);
      logger.info('Password reset requested', { userId: user.id });
    }

    // Always return success to prevent email enumeration
    return { message: 'If that email exists, a reset link has been sent.' };
  },

  async resetPassword(token: string, newPassword: string) {
    // Direct O(1) lookup — token is the key, userId is the value
    const matchedUserId = await cache.get<string>(`auth:password-reset:${token}`);

    if (!matchedUserId) {
      throw new AppError(
        'Invalid or expired reset token',
        HttpStatus.BAD_REQUEST,
        'INVALID_RESET_TOKEN',
      );
    }

    // Find user
    const user = await userRepository.findById(matchedUserId);
    if (!user || !user.is_active) {
      throw new AppError('User not found or deactivated', HttpStatus.BAD_REQUEST, 'USER_NOT_FOUND');
    }

    // Hash new password and update
    const passwordHash = await hash.hashPassword(newPassword);
    await userRepository.updatePassword(matchedUserId, passwordHash);

    // Delete the reset token so it can't be reused
    await cache.del(`auth:password-reset:${token}`);

    // Invalidate existing refresh token (force re-login)
    await cache.del(CacheKeys.refreshToken(matchedUserId));

    logger.info('Password reset successful', { userId: matchedUserId });

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  },
};
