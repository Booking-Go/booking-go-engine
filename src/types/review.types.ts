export interface Review {
  id: string;
  bookingId: string;
  businessId: string;
  customerId: string;
  rating: number;
  comment?: string;
  isPublished: boolean;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}
