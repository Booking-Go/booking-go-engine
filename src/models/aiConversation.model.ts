import mongoose, { Schema, Document } from 'mongoose';

/** A single message within an AI chat conversation. */
export interface IAiChatMessageDoc {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  timestamp: Date;
}

/** An AI chat conversation between a user and the assistant. */
export interface IAiConversation extends Document {
  userId: string;
  sessionId: string;
  messages: IAiChatMessageDoc[];
  status: 'active' | 'closed';
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const AiChatMessageSchema = new Schema<IAiChatMessageDoc>(
  {
    role: { type: String, required: true, enum: ['user', 'assistant'] },
    content: { type: String, required: true, maxlength: 5000 },
    intent: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const AiConversationSchema = new Schema<IAiConversation>(
  {
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, unique: true },
    messages: { type: [AiChatMessageSchema], default: [] },
    status: { type: String, default: 'active', enum: ['active', 'closed'] },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index for finding active sessions per user
AiConversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export const AiConversation = mongoose.model<IAiConversation>(
  'AiConversation',
  AiConversationSchema,
);
