export interface BusinessSettings {
  timezone: string;
  currency: string;
  bookingAdvanceTime: number;
  cancellationDeadline: number;
  slotDuration: number;
  autoConfirm: boolean;
  requireDeposit: boolean;
  depositAmount: number;
  bufferTime: number;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string;
  category: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  email: string;
  website?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  settings: BusinessSettings;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}
