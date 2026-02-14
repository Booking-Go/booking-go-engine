import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import chalk from 'chalk';

import { jwt } from '../libs';
import { logger } from '../libs';
import { messageService } from '../core/services/message.service';
import { sendMessageSchema } from '../core/validators';
import { Conversation } from '../models';

/** Authenticated socket with user info attached after handshake. */
interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    email: string;
    role: 'customer' | 'business_owner' | 'admin';
  };
}

/** Maps userId → Set of socketIds for multi-device support. */
const onlineUsers = new Map<string, Set<string>>();

let io: Server;

/**
 * Returns the Socket.IO server instance (call after `initializeSocket`).
 */
export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

/**
 * Initializes the Socket.IO server, attaches JWT auth middleware,
 * and registers real-time messaging event handlers.
 * @param httpServer - The HTTP server instance from Express.
 */
export const initializeSocket = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.CORS_ORIGIN === '*'
          ? true // reflect requesting origin (wildcard + credentials is invalid per spec)
          : process.env.CORS_ORIGIN,
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // ─── JWT Authentication middleware ──────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = jwt.verifyAccessToken(token);
    if (!payload) {
      return next(new Error('Invalid or expired token'));
    }

    (socket as AuthenticatedSocket).user = {
      id: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  });

  // ─── Connection handler ─────────────────────────────────────────────
  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { user } = socket;

    logger.info('Socket connected', { userId: user.id, socketId: socket.id });
    logSocket('connect', user.id, socket.id);

    // Track online users
    if (!onlineUsers.has(user.id)) {
      onlineUsers.set(user.id, new Set());
    }
    onlineUsers.get(user.id)!.add(socket.id);

    // Join a personal room so we can target by userId
    socket.join(`user:${user.id}`);

    // ── Event: join a conversation room ──
    socket.on('conversation:join', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      logSocket('conversation:join', user.id, socket.id, { conversationId });
    });

    // ── Event: leave a conversation room ──
    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      logSocket('conversation:leave', user.id, socket.id, { conversationId });
    });

    // ── Event: send message ──
    socket.on(
      'message:send',
      async (
        data: { conversationId: string; content: string },
        callback?: (response: { success: boolean; data?: unknown; error?: string }) => void,
      ) => {
        try {
          const parsed = sendMessageSchema.parse({ content: data.content });

          const senderRole = user.role === 'business_owner' ? 'business_owner' : 'customer';
          const message = await messageService.sendMessage(
            data.conversationId,
            user.id,
            senderRole as 'customer' | 'business_owner',
            parsed.content,
          );

          // Broadcast to everyone in the conversation room (including sender)
          io.to(`conversation:${data.conversationId}`).emit('message:received', message);

          // Also emit to user rooms of both parties for conversation list updates
          // (in case they're not in the conversation room)
          const conv = await Conversation.findById(data.conversationId).lean();
          if (conv) {
            const otherUserId =
              user.id === conv.customerId ? conv.businessOwnerId : conv.customerId;

            io.to(`user:${otherUserId}`).emit('conversation:updated', {
              conversationId: data.conversationId,
              lastMessageText: message.content.slice(0, 100),
              lastMessageAt: message.createdAt,
              senderId: user.id,
            });
          }

          if (callback) callback({ success: true, data: message });
          logSocket('message:send', user.id, socket.id, { conversationId: data.conversationId });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
          logger.error('Socket message:send error', { userId: user.id, error: errorMessage });
          if (callback) callback({ success: false, error: errorMessage });
        }
      },
    );

    // ── Event: typing indicator ──
    socket.on('message:typing', (data: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${data.conversationId}`).emit('message:typing', {
        userId: user.id,
        isTyping: data.isTyping,
      });
      logSocket('message:typing', user.id, socket.id, { typing: data.isTyping });
    });

    // ── Event: mark conversation as read ──
    socket.on('conversation:read', async (conversationId: string) => {
      try {
        await messageService.markConversationRead(conversationId, user.id);
        // Notify the other party that messages were read
        socket.to(`conversation:${conversationId}`).emit('conversation:read', {
          conversationId,
          readBy: user.id,
        });
      } catch (err: unknown) {
        logger.error('Socket conversation:read error', { userId: user.id, error: err });
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { userId: user.id, socketId: socket.id, reason });
      logSocket('disconnect', user.id, socket.id, { reason });

      const sockets = onlineUsers.get(user.id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(user.id);
        }
      }
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
};

/**
 * Prints a colorized WebSocket event log line to stdout.
 * Format:  ⚡ EVENT_NAME  userId  socketId  {meta}
 */
const logSocket = (
  event: string,
  userId: string,
  socketId: string,
  meta?: Record<string, unknown>,
): void => {
  const icon = chalk.magenta('⚡');
  const eventStr = colorEvent(event.padEnd(22));
  const userStr = chalk.dim(`user:${userId.slice(0, 8)}`);
  const sockStr = chalk.dim(`sock:${socketId.slice(0, 8)}`);
  const metaStr = meta ? chalk.gray(JSON.stringify(meta)) : '';

  process.stdout.write(`  ${icon} ${eventStr} ${userStr}  ${sockStr}  ${metaStr}\n`);
};

/** Color-code socket event names by category */
const colorEvent = (event: string): string => {
  const e = event.trim();
  if (e === 'connect') return chalk.green.bold(event);
  if (e === 'disconnect') return chalk.red.bold(event);
  if (e.startsWith('message:')) return chalk.yellow(event);
  if (e.startsWith('conversation:')) return chalk.cyan(event);
  return chalk.white(event);
};
