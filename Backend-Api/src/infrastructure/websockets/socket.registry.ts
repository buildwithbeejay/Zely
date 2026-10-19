import { Socket } from "socket.io";
import { logger } from "@/shared/utils/logger";

// userId → Set of socket IDs (user can have multiple tabs open)
const registry = new Map<string, Set<string>>();

// socketId → socket instance (for emitting)
const sockets = new Map<string, Socket>();

const adminSockets = new Set<string>();

export const socketRegistry = {
  register: (userId: string, socket: Socket, isAdmin = false) => {
    if (!registry.has(userId)) {
      registry.set(userId, new Set());
    }

    if (isAdmin) adminSockets.add(socket.id);

    registry.get(userId)!.add(socket.id);
    sockets.set(socket.id, socket);

    logger.info("WebSocket client registered", {
      totalConnections: registry.get(userId)!.size,
    });
  },

  unregister: (userId: string, socketId: string) => {
    registry.get(userId)?.delete(socketId);
    if (registry.get(userId)?.size === 0) {
      registry.delete(userId);
    }

    adminSockets.delete(socketId);

    sockets.delete(socketId);

    logger.info("WebSocket client unregistered");
  },

  // Emit event to all sockets for a user (handles multiple tabs)
  emitToUser: (userId: string, event: string, data: unknown) => {
    const socketIds = registry.get(userId);
    if (!socketIds || socketIds.size === 0) {
      logger.debug("No active WebSocket connections for user", { userId });
      return;
    }

    socketIds.forEach((socketId) => {
      const socket = sockets.get(socketId);
      if (socket?.connected) {
        socket.emit(event, data);
        logger.debug("WebSocket event emitted");
      }
    });
  },

  emitToAdmins: (event: string, data: unknown) => {
    if (adminSockets.size === 0) return;

    adminSockets.forEach((socketId) => {
      const socket = sockets.get(socketId);
      if (socket?.connected) {
        socket.emit(event, data);
      }
    });

    logger.debug("Emitted to admin sockets", { count: adminSockets.size });
  },

  isConnected: (userId: string): boolean => {
    return (registry.get(userId)?.size ?? 0) > 0;
  },
};
