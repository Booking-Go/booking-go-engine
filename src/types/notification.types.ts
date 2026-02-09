export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'booking_completed'
  | 'review_received'
  | 'general';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels: {
    email?: { sent: boolean; sentAt?: Date; error?: string };
    sms?: { sent: boolean; sentAt?: Date; error?: string };
    push?: { sent: boolean; sentAt?: Date; error?: string };
  };
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}
