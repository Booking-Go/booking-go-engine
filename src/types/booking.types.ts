export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Booking {
  id: string;
  slotId: string;
  businessId: string;
  customerId: string;
  serviceId?: string;
  status: BookingStatus;
  bookingDate: Date;
  startTime: Date;
  endTime: Date;
  numberOfPeople: number;
  totalPrice: number;
  depositPaid: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'business' | 'system';
  cancelledAt?: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  reminderSent: boolean;
  reminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
