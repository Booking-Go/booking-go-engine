import mongoose, { Schema, Document } from 'mongoose';

/**
 * Represents a registered FCM device token for push notifications.
 * Each user can have multiple tokens (multiple devices/browsers).
 */
export interface IDeviceToken extends Document {
  userId: string;
  token: string;
  deviceType: 'web' | 'android' | 'ios';
  userAgent?: string;
  isActive: boolean;
  lastUsedAt: Date;
  createdAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    deviceType: {
      type: String,
      required: true,
      enum: ['web', 'android', 'ios'],
      default: 'web',
    },
    userAgent: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient lookups
deviceTokenSchema.index({ userId: 1, isActive: 1 });

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);
