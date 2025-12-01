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
   * Also sets up error/close handlers for automatic cleanup
   */
  subscribeToSession(sessionId: string, ws: WebSocket): void {
    if (!this.sessionRooms.has(sessionId)) {
      this.sessionRooms.set(sessionId, new Set());
    }

    this.sessionRooms.get(sessionId)!.add(ws);
    
    // Set up automatic cleanup on connection close or error
    const cleanup = () => {
      this.unsubscribeFromSession(sessionId, ws);
      logger.info(`WebSocket auto-cleanup for session ${sessionId}`, "JobStatusService");
    };

    // Remove existing listeners if they exist to prevent duplicates
    ws.removeAllListeners('close');
    ws.removeAllListeners('error');

    // Add cleanup listeners
    ws.once('close', cleanup);
    ws.once('error', (error) => {
      logger.error(`WebSocket error for session ${sessionId}: ${error}`, "JobStatusService");
      cleanup();
    });

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
   * Used when connection is closed
   */
  unsubscribeFromAll(ws: WebSocket): void {
    let removedCount = 0;
    for (const [sessionId, room] of Array.from(this.sessionRooms.entries())) {
      if (room.delete(ws)) {
        removedCount++;
      }
      if (room.size === 0) {
        this.sessionRooms.delete(sessionId);
      }
    }
    
    if (removedCount > 0) {
      logger.info(`WebSocket unsubscribed from ${removedCount} session(s)`, "JobStatusService");
    }
    
    // Remove all event listeners to prevent memory leaks
    ws.removeAllListeners('close');
    ws.removeAllListeners('error');
    ws.removeAllListeners('message');
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
    for (const room of Array.from(this.sessionRooms.values())) {
      total += room.size;
    }
    return total;
  }

  /**
   * Periodic cleanup of dead connections
   * Should be called on a timer (e.g., every 60 seconds)
   */
  cleanupDeadConnections(): void {
    let cleanedCount = 0;
    const deadSessions: string[] = [];

    for (const [sessionId, room] of Array.from(this.sessionRooms.entries())) {
      const deadConnections: WebSocket[] = [];
      
      room.forEach((ws) => {
        if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
          deadConnections.push(ws);
        }
      });

      deadConnections.forEach((ws) => {
        room.delete(ws);
        ws.removeAllListeners(); // Clean up listeners
        cleanedCount++;
      });

      if (room.size === 0) {
        deadSessions.push(sessionId);
      }
    }

    // Remove empty session rooms
    deadSessions.forEach(sessionId => {
      this.sessionRooms.delete(sessionId);
    });

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} dead WebSocket connection(s) from ${deadSessions.length} session(s)`, "JobStatusService");
    }
  }
}

export const jobStatusService = new JobStatusService();
