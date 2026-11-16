import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { Response } from "express";

let io: SocketIOServer | null = null;
const sseClients = new Set<Response>();

export function initSocketService(httpServer: HttpServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
        if (!origin || config.corsOrigins.includes(origin) || (!config.isDeployed && LOCAL_ORIGIN.test(origin))) {
          return callback(null, true);
        }
        return callback(new Error("CORS origin rejected by Socket.IO"));
      },
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  io.on("connection", (socket: Socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`, { action: "socket.connected" });

    socket.on("join_conversation", (conversationId: string) => {
      if (conversationId) {
        socket.join(`conv_${conversationId}`);
      }
    });

    socket.on("leave_conversation", (conversationId: string) => {
      if (conversationId) {
        socket.leave(`conv_${conversationId}`);
      }
    });

    socket.on("disconnect", () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`, { action: "socket.disconnected" });
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function registerSSEClient(res: Response): () => void {
  sseClients.add(res);
  return () => {
    sseClients.delete(res);
  };
}

export function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function emitWhatsAppMessage(data: { conversation: any; message: any }) {
  if (io) {
    io.emit("whatsapp:message", data);
    if (data.conversation?._id) {
      io.to(`conv_${data.conversation._id}`).emit("whatsapp:conversation_message", data);
    }
  }
  broadcastSSE("whatsapp:message", data);
}

export function emitWhatsAppConversation(conversation: any) {
  if (io) {
    io.emit("whatsapp:conversation", conversation);
  }
  broadcastSSE("whatsapp:conversation", conversation);
}

export function emitWhatsAppStatus(data: {
  messageId: string;
  status: string;
  timestamp: string | number | Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  conversationId?: string;
  errorDetails?: string;
}) {
  if (io) {
    io.emit("whatsapp:status", data);
    if (data.conversationId) {
      io.to(`conv_${data.conversationId}`).emit("whatsapp:conversation_status", data);
    }
  }
  broadcastSSE("whatsapp:status", data);
}
