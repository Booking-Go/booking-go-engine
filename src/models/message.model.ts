import mongoose, { Schema, Document } from 'mongoose';

/** A single message within a conversation. */
export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  senderRole: 'customer' | 'business_owner';
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderRole: { type: String, required: true, enum: ['customer', 'business_owner'] },
    content: { type: String, required: true, maxlength: 2000 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

// For efficient message history queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
