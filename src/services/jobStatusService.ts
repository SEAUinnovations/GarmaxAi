import { logger } from "../utils/winston-logger";
import type { WebSocket } from "ws";

export interface SessionStatusUpdate {
  sessionId: string;
  status: string;
  progress: number;
  message: string;
  estimatedSecondsRemaining?: number;
  previewImageUrl?: string;
  previewExpiresAt?: string;
  renderedImageUrl?: string;
}

/**
 * Job Status Service
 * Manages WebSocket connections and broadcasts session status updates
 */
export class JobStatusService {
  private sessionRooms: Map<string, Set<WebSocket>> = new Map();

  /**
   * Subscribe a WebSocket connection to a session
   */
  subscribeToSession(sessionId: string, ws: WebSocket): void {
    if (!this.sessionRooms.has(sessionId)) {
      this.sessionRooms.set(sessionId, new Set());
    }

    this.sessionRooms.get(sessionId)!.add(ws);
    logger.info(`WebSocket subscribed to session ${sessionId}`, "JobStatusService");
  }

  /**
   * Unsubscribe a WebSocket connection from a session
   */
  unsubscribeFromSession(sessionId: string, ws: WebSocket): void {
    const room = this.sessionRooms.get(sessionId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        this.sessionRooms.delete(sessionId);
      }
      logger.info(`WebSocket unsubscribed from session ${sessionId}`, "JobStatusService");
    }
  }

  /**
   * Unsubscribe a WebSocket from all sessions
   */
  unsubscribeFromAll(ws: WebSocket): void {
    for (const [sessionId, room] of this.sessionRooms.entries()) {
      room.delete(ws);
      if (room.size === 0) {
        this.sessionRooms.delete(sessionId);
      }
    }
  }

  /**
   * Broadcast status update to all subscribers of a session
   */
  broadcastSessionStatus(sessionId: string, update: SessionStatusUpdate): void {
    const room = this.sessionRooms.get(sessionId);
    if (!room || room.size === 0) {
      logger.debug(`No subscribers for session ${sessionId}`, "JobStatusService");
      return;
    }

    const message = JSON.stringify(update);
    const deadConnections: WebSocket[] = [];

    room.forEach((ws) => {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        } else {
          deadConnections.push(ws);
        }
      } catch (error) {
        logger.error(`Failed to send to WebSocket: ${error}`, "JobStatusService");
        deadConnections.push(ws);
      }
    });

    // Clean up dead connections
    deadConnections.forEach((ws) => {
      room.delete(ws);
    });

    logger.info(
      `Broadcasted status to ${room.size} subscribers for session ${sessionId}: ${update.status} (${update.progress}%)`,
      "JobStatusService"
    );
  }

  /**
   * Get subscriber count for a session
   */
  getSubscriberCount(sessionId: string): number {
    return this.sessionRooms.get(sessionId)?.size || 0;
  }

  /**
   * Get total active connections
   */
  getTotalConnections(): number {
    let total = 0;
    for (const room of this.sessionRooms.values()) {
      total += room.size;
    }
    return total;
  }
}

export const jobStatusService = new JobStatusService();
