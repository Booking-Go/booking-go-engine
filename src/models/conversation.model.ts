import mongoose, { Schema, Document } from 'mongoose';

/** A conversation between a customer and a business owner. */
export interface IConversation extends Document {
  businessId: string;
  customerId: string;
  businessOwnerId: string;
  lastMessageAt: Date;
  lastMessageText: string;
  customerUnreadCount: number;
  ownerUnreadCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    businessId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    businessOwnerId: { type: String, required: true, index: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageText: { type: String, default: '' },
    customerUnreadCount: { type: Number, default: 0 },
    ownerUnreadCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Compound index: one conversation per customer-business pair
ConversationSchema.index({ customerId: 1, businessId: 1 }, { unique: true });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
