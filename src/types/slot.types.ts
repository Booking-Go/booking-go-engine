export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';

export interface Slot {
  id: string;
  businessId: string;
  serviceId?: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  bookedCount: number;
  isAvailable: boolean;
  price: number;
  recurrencePattern?: RecurrencePattern;
  recurrenceEndDate?: Date;
  parentSlotId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
