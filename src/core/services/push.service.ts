import { getFirebaseMessaging } from '../../config/firebase';
import { DeviceToken } from '../../models/deviceToken.model';
import { logger } from '../../libs';

/** Payload shape for sending a push notification. */
interface PushPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

/**
 * Push notification service — manages FCM tokens and sends push notifications.
 *
 * Gracefully degrades when Firebase is not configured: token registration
 * still stores tokens, but send operations are no-ops.
 */
export const pushService = {
  /**
   * Registers (or re-activates) an FCM device token for a user.
   *
   * @param userId - The user's UUID.
   * @param token - The FCM registration token from the client.
   * @param deviceType - Device platform ('web', 'android', 'ios').
   * @param userAgent - Optional browser/device user-agent string.
   */
  async registerToken(
    userId: string,
    token: string,
    deviceType: 'web' | 'android' | 'ios' = 'web',
    userAgent?: string,
  ) {
    logger.debug('pushService.registerToken', { userId, deviceType });

    await DeviceToken.findOneAndUpdate(
      { token },
      {
        userId,
        token,
        deviceType,
        userAgent,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true },
    );
  },

  /**
   * Unregisters (deactivates) an FCM device token.
   *
   * @param userId - The user's UUID.
   * @param token - The FCM registration token to remove.
   */
  async unregisterToken(userId: string, token: string) {
    logger.debug('pushService.unregisterToken', { userId });

    await DeviceToken.findOneAndUpdate({ userId, token }, { isActive: false });
  },

  /**
   * Retrieves all active FCM tokens for a user.
   *
   * @param userId - The user's UUID.
   * @returns Array of active FCM token strings.
   */
  async getActiveTokens(userId: string): Promise<string[]> {
    const tokens = await DeviceToken.find({ userId, isActive: true }, { token: 1 }).lean();
    return tokens.map((t) => t.token);
  },

  /**
   * Sends a push notification to a specific user (all their devices).
   * Silently does nothing if Firebase is not configured.
   *
   * @param userId - The target user's UUID.
   * @param payload - The notification payload (title, body, data).
   */
  async sendToUser(userId: string, payload: PushPayload) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      logger.debug('Push skipped — Firebase not configured');
      return;
    }

    const tokens = await this.getActiveTokens(userId);
    if (tokens.length === 0) {
      logger.debug('Push skipped — no active tokens', { userId });
      return;
    }

    logger.debug('pushService.sendToUser', { userId, tokenCount: tokens.length });

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
      },
      data: payload.data ?? {},
      tokens,
    };

    try {
      const response = await messaging.sendEachForMulticast(message);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            // These error codes indicate the token is permanently invalid
            if (
              errorCode === 'messaging/invalid-registration-token' ||
              errorCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          logger.info(`Deactivating ${invalidTokens.length} invalid FCM token(s)`);
          await DeviceToken.updateMany({ token: { $in: invalidTokens } }, { isActive: false });
        }
      }

      logger.debug('Push sent', {
        userId,
        success: response.successCount,
        failures: response.failureCount,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Push notification failed for user ${userId}: ${message}`);
    }
  },

  /**
   * Sends a push notification to multiple users.
   *
   * @param userIds - Array of user UUIDs.
   * @param payload - The notification payload.
   */
  async sendToUsers(userIds: string[], payload: PushPayload) {
    await Promise.allSettled(userIds.map((userId) => this.sendToUser(userId, payload)));
  },
};
