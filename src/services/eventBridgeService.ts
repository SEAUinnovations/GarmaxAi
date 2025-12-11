import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '../utils/winston-logger';
import type { TryonSession } from '@shared/schema';

const eventBridgeClient = new EventBridgeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const STAGE = process.env.STAGE || 'dev';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || `GarmaxAi-Tryon-${STAGE}`;

/**
 * EventBridge Service
 * Publishes events for async try-on processing orchestration
 */
export class EventBridgeService {
  
  /**
   * Publish try-on session created event
   * Triggers SMPL processing Lambda
   */
  async publishTryonEvent(session: TryonSession): Promise<void> {
    try {
      const command = new PutEventsCommand({
        Entries: [{
          Source: 'garmax.tryon',
          DetailType: 'TryonSessionCreated',
          Detail: JSON.stringify({
            sessionId: session.id,
            userId: session.userId,
            avatarId: session.avatarId,
            photoId: session.photoId,
            garmentIds: session.garmentIds,
            promptGarmentIds: session.promptGarmentIds,
            status: session.status,
            createdAt: session.createdAt,
          }),
          EventBusName: EVENT_BUS_NAME,
        }],
      });

      await eventBridgeClient.send(command);

      const sourceType = session.photoId ? 'photo' : 'avatar';
      logger.info(
        `Published TryonSessionCreated event for session ${session.id} (source: ${sourceType})`, 
        'EventBridgeService'
      );

    } catch (error: any) {
      logger.error(`Failed to publish try-on event: ${error.message}`, 'EventBridgeService');
      // Don't throw - session is already created, event failure shouldn't block response
      // Failed sessions will be picked up by retry mechanisms
    }
  }

  /**
   * Publish render approval event
   * Triggers AI rendering Lambda
   */
  async publishRenderEvent(session: TryonSession): Promise<void> {
    try {
      const command = new PutEventsCommand({
        Entries: [{
          Source: 'garmax.tryon',
          DetailType: 'TryonRenderApproved',
          Detail: JSON.stringify({
            sessionId: session.id,
            userId: session.userId,
            avatarId: session.avatarId,
            photoId: session.photoId,
            garmentIds: session.garmentIds,
            promptGarmentIds: session.promptGarmentIds,
            renderQuality: session.renderQuality,
            backgroundScene: session.backgroundScene,
            customBackgroundPrompt: session.customBackgroundPrompt,
            status: session.status,
          }),
          EventBusName: EVENT_BUS_NAME,
        }],
      });

      await eventBridgeClient.send(command);

      logger.info(`Published TryonRenderApproved event for session ${session.id}`, 'EventBridgeService');

    } catch (error: any) {
      logger.error(`Failed to publish render event: ${error.message}`, 'EventBridgeService');
      // Don't throw - session approval is already recorded
    }
  }

  /**
   * Publish session failure event
   * Used for error tracking and alerting
   */
  async publishSessionFailure(sessionId: string, userId: string, error: string): Promise<void> {
    try {
      const command = new PutEventsCommand({
        Entries: [{
          Source: 'garmax.tryon',
          DetailType: 'TryonSessionFailed',
          Detail: JSON.stringify({
            sessionId,
            userId,
            error,
            timestamp: new Date().toISOString(),
          }),
          EventBusName: EVENT_BUS_NAME,
        }],
      });

      await eventBridgeClient.send(command);

      logger.info(`Published TryonSessionFailed event for session ${sessionId}`, 'EventBridgeService');

    } catch (eventError: any) {
      logger.error(`Failed to publish failure event: ${eventError.message}`, 'EventBridgeService');
      // Swallow error - we don't want to mask the original error
    }
  }
}

export const eventBridgeService = new EventBridgeService();
