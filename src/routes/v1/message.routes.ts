import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { authenticate, AuthRequest } from '../../middleware';
import { HttpStatus, Pagination } from '../../core/constants';
import { sendMessageSchema, startConversationSchema } from '../../core/validators';
import { messageService } from '../../core/services/message.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /messages/conversations — start or get a conversation (customer initiates)
router.post(
  '/conversations',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = startConversationSchema.parse(req.body);
    const conversation = await messageService.getOrCreateConversation(
      req.user!.id,
      input.businessId,
    );

    // If a message was provided, send it as the first message
    const message = await messageService.sendMessage(
      conversation.id,
      req.user!.id,
      req.user!.role === 'business_owner' ? 'business_owner' : 'customer',
      input.message,
    );

    res.status(HttpStatus.CREATED).json({
      success: true,
      data: { conversation, message },
    });
  }),
);

// GET /messages/conversations — list all conversations for the user
router.get(
  '/conversations',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const result = await messageService.listConversations(
      req.user!.id,
      req.user!.role,
      page,
      limit,
    );
    res.status(HttpStatus.OK).json({
      success: true,
      data: result.conversations,
      meta: result.meta,
    });
  }),
);

// GET /messages/conversations/:conversationId — get messages for a conversation
router.get(
  '/conversations/:conversationId',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );
    const result = await messageService.getMessages(
      req.params.conversationId,
      req.user!.id,
      page,
      limit,
    );
    res.status(HttpStatus.OK).json({
      success: true,
      data: result.messages,
      meta: result.meta,
    });
  }),
);

// POST /messages/conversations/:conversationId — send a message
router.post(
  '/conversations/:conversationId',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = sendMessageSchema.parse(req.body);
    const message = await messageService.sendMessage(
      req.params.conversationId,
      req.user!.id,
      req.user!.role === 'business_owner' ? 'business_owner' : 'customer',
      input.content,
    );
    res.status(HttpStatus.CREATED).json({ success: true, data: message });
  }),
);

// PUT /messages/conversations/:conversationId/read — mark conversation as read
router.put(
  '/conversations/:conversationId/read',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    await messageService.markConversationRead(
      req.params.conversationId,
      req.user!.id,
    );
    res.status(HttpStatus.OK).json({
      success: true,
      data: { message: 'Conversation marked as read' },
    });
  }),
);

// GET /messages/unread-count — total unread messages across all conversations
router.get(
  '/unread-count',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const count = await messageService.getTotalUnreadCount(
      req.user!.id,
      req.user!.role,
    );
    res.status(HttpStatus.OK).json({ success: true, data: { count } });
  }),
);

export default router;
