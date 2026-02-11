import { logger } from '../../libs';
import { AppError } from '../../middleware/errorHandler';
import { HttpStatus, Pagination } from '../constants';
import { Conversation, Message } from '../../models';
import { pgPool } from '../../config';

/**
 * Message service — business logic for customer ↔ business owner messaging.
 */
export const messageService = {
  /**
   * Gets or creates a conversation between a customer and a business.
   * @param customerId - The customer's UUID.
   * @param businessId - The business UUID.
   * @returns The conversation document.
   */
  async getOrCreateConversation(customerId: string, businessId: string) {
    logger.debug('messageService.getOrCreateConversation', { customerId, businessId });

    // Look up the business owner from PostgreSQL
    const { rows } = await pgPool.query(
      'SELECT owner_id FROM businesses WHERE id = $1',
      [businessId],
    );
    if (!rows[0]) {
      throw new AppError('Business not found', HttpStatus.NOT_FOUND);
    }
    const businessOwnerId: string = rows[0].owner_id;

    // Prevent owners messaging their own business
    if (customerId === businessOwnerId) {
      throw new AppError('You cannot message your own business', HttpStatus.BAD_REQUEST);
    }

    let conversation = await Conversation.findOne({ customerId, businessId });

    if (!conversation) {
      conversation = await Conversation.create({
        businessId,
        customerId,
        businessOwnerId,
      });
    }

    // Attach business name for convenience
    const bizName = await pgPool.query('SELECT name FROM businesses WHERE id = $1', [businessId]);
    const customerNameResult = await pgPool.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [customerId],
    );

    return {
      id: conversation._id.toString(),
      businessId: conversation.businessId,
      customerId: conversation.customerId,
      businessOwnerId: conversation.businessOwnerId,
      businessName: bizName.rows[0]?.name || 'Unknown',
      customerName: customerNameResult.rows[0]
        ? `${customerNameResult.rows[0].first_name} ${customerNameResult.rows[0].last_name}`
        : 'Unknown',
      lastMessageAt: conversation.lastMessageAt,
      lastMessageText: conversation.lastMessageText,
      customerUnreadCount: conversation.customerUnreadCount,
      ownerUnreadCount: conversation.ownerUnreadCount,
      createdAt: conversation.createdAt,
    };
  },

  /**
   * Lists all conversations for a user (as customer or business owner).
   * @param userId - The user's UUID.
   * @param role - The user's role.
   * @param page - Page number.
   * @param limit - Items per page.
   */
  async listConversations(
    userId: string,
    role: string,
    page: number = Pagination.DEFAULT_PAGE,
    limit: number = Pagination.DEFAULT_LIMIT,
  ) {
    logger.debug('messageService.listConversations', { userId, role });

    const filter = role === 'business_owner'
      ? { businessOwnerId: userId, isActive: true }
      : { customerId: userId, isActive: true };

    const total = await Conversation.countDocuments(filter);
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Batch-fetch names from PostgreSQL
    const businessIds = [...new Set(conversations.map((c) => c.businessId))];
    const customerIds = [...new Set(conversations.map((c) => c.customerId))];

    const businessNames: Record<string, string> = {};
    const customerNames: Record<string, string> = {};

    if (businessIds.length > 0) {
      const placeholders = businessIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await pgPool.query(
        `SELECT id, name FROM businesses WHERE id IN (${placeholders})`,
        businessIds,
      );
      for (const row of rows) {
        businessNames[row.id] = row.name;
      }
    }

    if (customerIds.length > 0) {
      const placeholders = customerIds.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await pgPool.query(
        `SELECT id, first_name, last_name FROM users WHERE id IN (${placeholders})`,
        customerIds,
      );
      for (const row of rows) {
        customerNames[row.id] = `${row.first_name} ${row.last_name}`;
      }
    }

    const data = conversations.map((c) => ({
      id: c._id.toString(),
      businessId: c.businessId,
      customerId: c.customerId,
      businessOwnerId: c.businessOwnerId,
      businessName: businessNames[c.businessId] || 'Unknown',
      customerName: customerNames[c.customerId] || 'Unknown',
      lastMessageAt: c.lastMessageAt,
      lastMessageText: c.lastMessageText,
      unreadCount: role === 'business_owner' ? c.ownerUnreadCount : c.customerUnreadCount,
      createdAt: c.createdAt,
    }));

    return {
      conversations: data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Sends a message in a conversation.
   * @param conversationId - The conversation's MongoDB ObjectId.
   * @param senderId - The sender's UUID.
   * @param senderRole - 'customer' or 'business_owner'.
   * @param content - Message text.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderRole: 'customer' | 'business_owner',
    content: string,
  ) {
    logger.debug('messageService.sendMessage', { conversationId, senderId });

    // Verify conversation exists and sender belongs to it
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new AppError('Conversation not found', HttpStatus.NOT_FOUND);
    }

    const isMember =
      conversation.customerId === senderId ||
      conversation.businessOwnerId === senderId;
    if (!isMember) {
      throw new AppError('You are not part of this conversation', HttpStatus.FORBIDDEN);
    }

    // Create message
    const message = await Message.create({
      conversationId,
      senderId,
      senderRole,
      content: content.trim(),
    });

    // Update conversation metadata
    const unreadUpdate = senderRole === 'customer'
      ? { $inc: { ownerUnreadCount: 1 } }
      : { $inc: { customerUnreadCount: 1 } };

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: message.createdAt,
      lastMessageText: content.trim().slice(0, 100),
      ...unreadUpdate,
    });

    return {
      id: message._id.toString(),
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderRole: message.senderRole,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };
  },

  /**
   * Gets paginated messages for a conversation.
   * @param conversationId - The conversation's MongoDB ObjectId.
   * @param userId - The requesting user's UUID (ownership check).
   * @param page - Page number.
   * @param limit - Items per page.
   */
  async getMessages(
    conversationId: string,
    userId: string,
    page: number = Pagination.DEFAULT_PAGE,
    limit: number = Pagination.DEFAULT_LIMIT,
  ) {
    logger.debug('messageService.getMessages', { conversationId, userId });

    const conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) {
      throw new AppError('Conversation not found', HttpStatus.NOT_FOUND);
    }

    const isMember =
      conversation.customerId === userId ||
      conversation.businessOwnerId === userId;
    if (!isMember) {
      throw new AppError('You are not part of this conversation', HttpStatus.FORBIDDEN);
    }

    const total = await Message.countDocuments({ conversationId });
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      messages: messages.map((m) => ({
        id: m._id.toString(),
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderRole: m.senderRole,
        content: m.content,
        isRead: m.isRead,
        createdAt: m.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Marks all messages in a conversation as read for a given user.
   * @param conversationId - The conversation's MongoDB ObjectId.
   * @param userId - The reading user's UUID.
   */
  async markConversationRead(conversationId: string, userId: string) {
    logger.debug('messageService.markConversationRead', { conversationId, userId });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new AppError('Conversation not found', HttpStatus.NOT_FOUND);
    }

    const isCustomer = conversation.customerId === userId;
    const isOwner = conversation.businessOwnerId === userId;

    if (!isCustomer && !isOwner) {
      throw new AppError('You are not part of this conversation', HttpStatus.FORBIDDEN);
    }

    // Mark unread messages from the *other* party as read
    const otherRole = isCustomer ? 'business_owner' : 'customer';
    await Message.updateMany(
      { conversationId, senderRole: otherRole, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    // Reset unread counter
    if (isCustomer) {
      await Conversation.findByIdAndUpdate(conversationId, { customerUnreadCount: 0 });
    } else {
      await Conversation.findByIdAndUpdate(conversationId, { ownerUnreadCount: 0 });
    }
  },

  /**
   * Returns the total unread message count across all conversations for a user.
   * @param userId - The user's UUID.
   * @param role - The user's role.
   */
  async getTotalUnreadCount(userId: string, role: string): Promise<number> {
    logger.debug('messageService.getTotalUnreadCount', { userId, role });

    const filter = role === 'business_owner'
      ? { businessOwnerId: userId }
      : { customerId: userId };

    const field = role === 'business_owner' ? 'ownerUnreadCount' : 'customerUnreadCount';

    const result = await Conversation.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: `$${field}` } } },
    ]);

    return result[0]?.total || 0;
  },
};
