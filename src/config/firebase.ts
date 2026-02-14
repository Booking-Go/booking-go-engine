import * as admin from 'firebase-admin';
import { logger } from '../libs';

let firebaseApp: admin.app.App | null = null;

/**
 * Initializes Firebase Admin SDK.
 * Expects the `FIREBASE_SERVICE_ACCOUNT` env var to contain the
 * JSON string of the service account key (from Firebase Console).
 *
 * If the env var is not set, FCM push notifications are disabled
 * gracefully — the app still works without push.
 */
export const initFirebase = (): void => {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!serviceAccountJson) {
    logger.warn('FIREBASE_SERVICE_ACCOUNT env var not set — push notifications disabled');
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('Firebase Admin SDK initialized successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Failed to initialize Firebase Admin SDK: ${message}`);
  }
};

/**
 * Returns the Firebase messaging instance if initialized.
 * Returns null if Firebase is not configured (push disabled).
 */
export const getFirebaseMessaging = (): admin.messaging.Messaging | null => {
  if (!firebaseApp) return null;
  return admin.messaging();
};
