import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalytics extends Document {
  businessId: string;
  date: Date;
  period: 'daily' | 'weekly' | 'monthly';
  metrics: {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    completedBookings: number;
    noShowBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
    newCustomers: number;
    returningCustomers: number;
    averageRating: number;
    totalReviews: number;
    peakHours: number[];
    occupancyRate: number;
  };
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    bookingCount: number;
    revenue: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsSchema = new Schema<IAnalytics>(
  {
    businessId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    period: { type: String, required: true, enum: ['daily', 'weekly', 'monthly'] },
    metrics: {
      totalBookings: { type: Number, default: 0 },
      confirmedBookings: { type: Number, default: 0 },
      cancelledBookings: { type: Number, default: 0 },
      completedBookings: { type: Number, default: 0 },
      noShowBookings: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageBookingValue: { type: Number, default: 0 },
      newCustomers: { type: Number, default: 0 },
      returningCustomers: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      totalReviews: { type: Number, default: 0 },
      peakHours: [{ type: Number }],
      occupancyRate: { type: Number, default: 0 },
    },
    topServices: [
      {
        serviceId: String,
        serviceName: String,
        bookingCount: Number,
        revenue: Number,
      },
    ],
  },
  { timestamps: true },
);

AnalyticsSchema.index({ businessId: 1, period: 1, date: -1 }, { unique: true });

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
