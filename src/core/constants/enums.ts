/**
 * Application-wide enums — single source of truth for status values.
 * These mirror the CHECK constraints in PostgreSQL and are used in validators & services.
 */

export enum UserRole {
  CUSTOMER = 'customer',
  BUSINESS_OWNER = 'business_owner',
  ADMIN = 'admin',
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

export enum SlotStatus {
  AVAILABLE = 'available',
  BOOKED = 'booked',
  BLOCKED = 'blocked',
}

export enum DayOfWeek {
  MONDAY = 0,
  TUESDAY = 1,
  WEDNESDAY = 2,
  THURSDAY = 3,
  FRIDAY = 4,
  SATURDAY = 5,
  SUNDAY = 6,
}

export enum NotificationType {
  BOOKING_CREATED = 'booking_created',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_REMINDER = 'booking_reminder',
  REVIEW_RECEIVED = 'review_received',
  BUSINESS_UPDATE = 'business_update',
}

export enum ActivityAction {
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  PASSWORD_RESET = 'password_reset',
  BUSINESS_CREATED = 'business_created',
  BUSINESS_UPDATED = 'business_updated',
  SERVICE_CREATED = 'service_created',
  SLOT_CREATED = 'slot_created',
  BOOKING_CREATED = 'booking_created',
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_COMPLETED = 'booking_completed',
  REVIEW_CREATED = 'review_created',
}
