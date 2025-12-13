import { IncomingMessage, Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "../utils/winston-logger";
import { jobStatusService } from "../services/jobStatusService";
import { storage } from "../storage";

interface WebSocketMessage {
  action: "subscribe" | "unsubscribe";
  sessionId: string;
}

/**
 * Initialize WebSocket server for real-time try-on session updates
 */
export function initializeTryonWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);

    if (pathname === "/ws/tryon") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Handle WebSocket connection
  wss.on("connection", (ws: WebSocket) => {
    logger.info("WebSocket connection established", "TryonWebSocket");

    // Handle messages from client
    ws.on("message", async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        logger.info(`WebSocket message received: ${message.action} for session ${message.sessionId}`, "TryonWebSocket");

        if (message.action === "subscribe") {
          // Verify session exists (security check)
          try {
            const session = await storage.getTryonSession(message.sessionId);
            if (session) {
              jobStatusService.subscribeToSession(message.sessionId, ws);
              logger.info(`Client subscribed to session ${message.sessionId}`, "TryonWebSocket");
              ws.send(JSON.stringify({ 
                type: "subscribed", 
                sessionId: message.sessionId 
              }));
            } else {
              logger.warn(`Session not found: ${message.sessionId}`, "TryonWebSocket");
              ws.send(JSON.stringify({ 
                type: "error", 
                message: "Session not found" 
              }));
            }
          } catch (error) {
            logger.error(`Error fetching session ${message.sessionId}: ${error}`, "TryonWebSocket");
            ws.send(JSON.stringify({ 
              type: "error", 
              message: "Error verifying session" 
            }));
          }
        } else if (message.action === "unsubscribe") {
          jobStatusService.unsubscribeFromSession(message.sessionId, ws);
          logger.info(`Client unsubscribed from session ${message.sessionId}`, "TryonWebSocket");
          ws.send(JSON.stringify({ 
            type: "unsubscribed", 
            sessionId: message.sessionId 
          }));
        } else {
          logger.warn(`Unknown WebSocket action: ${message.action}`, "TryonWebSocket");
          ws.send(JSON.stringify({ 
            type: "error", 
            message: "Unknown action" 
          }));
        }
      } catch (error) {
        logger.error(`WebSocket message error: ${error}`, "TryonWebSocket");
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Invalid message format" 
        }));
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      jobStatusService.unsubscribeFromAll(ws);
      logger.info("WebSocket connection closed", "TryonWebSocket");
    });

    // Handle errors
    ws.on("error", (error) => {
      logger.error(`WebSocket error: ${error}`, "TryonWebSocket");
      jobStatusService.unsubscribeFromAll(ws);
    });

    // Send welcome message
    ws.send(JSON.stringify({ 
      type: "connected", 
      message: "WebSocket connected to Try-On service" 
    }));
  });

  logger.info("Try-On WebSocket server initialized on /ws/tryon", "TryonWebSocket");
}
