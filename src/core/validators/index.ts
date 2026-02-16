// Auth validators
export {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validator';
export type {
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth.validator';

// User validators
export { updateUserSchema } from './user.validator';
export type { UpdateUserInput } from './user.validator';

// Business validators
export {
  createBusinessSchema,
  updateBusinessSchema,
  businessHoursSchema,
  businessHolidaySchema,
} from './business.validator';
export type {
  CreateBusinessInput,
  UpdateBusinessInput,
  BusinessHoursInput,
  BusinessHolidayInput,
} from './business.validator';

// Service validators
export { createServiceSchema, updateServiceSchema } from './service.validator';
export type { CreateServiceInput, UpdateServiceInput } from './service.validator';

// Slot validators
export {
  createSlotSchema,
  bulkCreateSlotsSchema,
  updateSlotSchema,
  availableSlotsQuerySchema,
} from './slot.validator';
export type {
  CreateSlotInput,
  BulkCreateSlotsInput,
  UpdateSlotInput,
  AvailableSlotsQuery,
} from './slot.validator';

// Booking validators
export { createBookingSchema, updateBookingSchema, cancelBookingSchema } from './booking.validator';
export type {
  CreateBookingInput,
  UpdateBookingInput,
  CancelBookingInput,
} from './booking.validator';

// Review validators
export { createReviewSchema } from './review.validator';
export type { CreateReviewInput } from './review.validator';

// Message validators
export { sendMessageSchema, startConversationSchema } from './message.validator';
export type { SendMessageInput, StartConversationInput } from './message.validator';

// Common validators
export { paginationQuerySchema, uuidParamSchema } from './common.validator';
export type { PaginationQuery, UuidParam } from './common.validator';

// Device token validators
export { registerDeviceTokenSchema, unregisterDeviceTokenSchema } from './device-token.validator';
export type {
  RegisterDeviceTokenInput,
  UnregisterDeviceTokenInput,
} from './device-token.validator';

// AI chat validators
export { sendAiMessageSchema, aiSearchSchema } from './ai-chat.validator';
export type { SendAiMessageInput, AiSearchInput } from './ai-chat.validator';
