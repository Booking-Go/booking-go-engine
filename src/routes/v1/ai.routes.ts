import { Router, Response } from 'express';

import { asyncWrapper } from '../../libs';
import { authenticate, AuthRequest } from '../../middleware';
import { HttpStatus, Pagination } from '../../core/constants';
import { sendAiMessageSchema, aiSearchSchema } from '../../core/validators';
import { aiChatService } from '../../core/services/ai-chat.service';

const router = Router();

// All AI chat routes require authentication
router.use(authenticate);

// POST /ai/chat — Send a message to the AI assistant
router.post(
  '/chat',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = sendAiMessageSchema.parse(req.body);
    const result = await aiChatService.sendMessage(req.user!.id, input);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result,
    });
  }),
);

// POST /ai/chat/stream — Stream a message response via SSE (token-by-token)
router.post('/chat/stream', authenticate, async (req: AuthRequest, res: Response) => {
  const input = sendAiMessageSchema.parse(req.body);

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Handle client disconnect
  let aborted = false;
  req.on('close', () => {
    aborted = true;
  });

  try {
    await aiChatService.sendMessageStream(
      req.user!.id,
      input,
      (meta) => {
        if (!aborted) {
          res.write(`event: meta\ndata: ${JSON.stringify(meta)}\n\n`);
        }
      },
      (token) => {
        if (!aborted) {
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      },
      (data) => {
        if (!aborted) {
          res.write(`event: done\ndata: ${JSON.stringify(data)}\n\n`);
        }
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stream failed';
    if (!aborted) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    }
  }

  if (!aborted) {
    res.end();
  }
});

// GET /ai/chat/history — Get conversation history
router.get(
  '/chat/history',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || Pagination.DEFAULT_PAGE);
    const limit = Math.min(
      Pagination.MAX_LIMIT,
      Math.max(1, parseInt(req.query.limit as string) || Pagination.DEFAULT_LIMIT),
    );

    const result = await aiChatService.getHistory(req.user!.id, page, limit);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result.conversations,
      meta: result.meta,
    });
  }),
);

// GET /ai/chat/session/:sessionId — Get a specific chat session
router.get(
  '/chat/session/:sessionId',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const result = await aiChatService.getSession(req.user!.id, req.params.sessionId);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result,
    });
  }),
);

// DELETE /ai/chat/session/:sessionId? — End a chat session
router.delete(
  '/chat/session/:sessionId?',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const result = await aiChatService.endSession(req.user!.id, req.params.sessionId);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result,
    });
  }),
);

// POST /ai/search — Semantic search via AI embeddings
router.post(
  '/search',
  asyncWrapper(async (req: AuthRequest, res: Response) => {
    const input = aiSearchSchema.parse(req.body);
    const result = await aiChatService.search(input);

    res.status(HttpStatus.OK).json({
      success: true,
      data: result,
    });
  }),
);

export default router;
