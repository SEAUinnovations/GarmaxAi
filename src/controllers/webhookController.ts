import { Request, Response } from 'express';
import { storage } from '../storage';
import { webhookService } from '../services/webhookService';
import { organizationService } from '../services/organizationService';
import { logger } from '../utils/winston-logger';
import type { EnterpriseAuthRequest } from '../types/enterprise';
import { randomBytes } from 'crypto';

/**
 * Create webhook configuration
 * POST /api/organizations/:orgId/webhooks
 */
export async function createWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;
    const { url, events } = req.body;

    // Validate required fields
    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'url and events (non-empty array) are required'
      });
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      res.status(400).json({
        error: 'INVALID_URL',
        message: 'Invalid webhook URL format'
      });
      return;
    }

    // Check permission
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'webhooks:manage' as any);
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to manage webhooks'
      });
      return;
    }

    // Generate webhook secret
    const secret = randomBytes(32).toString('hex');

    // Create webhook
    const webhook = await storage.createWebhook({
      organizationId: orgId,
      url,
      secret,
      events,
      status: 'active',
      failureCount: 0
    });

    res.status(201).json({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        secret, // Show secret only once
        createdAt: webhook.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error creating webhook: ${error}`, 'WebhookController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to create webhook'
    });
  }
}

/**
 * List webhooks for organization
 * GET /api/organizations/:orgId/webhooks
 */
export async function listWebhooks(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check membership
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    const webhooks = await storage.listWebhooks(orgId);

    res.json({
      webhooks: webhooks.map(webhook => ({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        failureCount: webhook.failureCount,
        lastSuccessAt: webhook.lastSuccessAt,
        lastFailureAt: webhook.lastFailureAt,
        createdAt: webhook.createdAt
        // Note: secret is not returned for security
      }))
    });
  } catch (error) {
    logger.error(`Error listing webhooks: ${error}`, 'WebhookController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to list webhooks'
    });
  }
}

/**
 * Get webhook details
 * GET /api/organizations/:orgId/webhooks/:webhookId
 */
export async function getWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, webhookId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check membership
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    const webhook = await storage.getWebhook(webhookId);

    if (!webhook || webhook.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Webhook not found'
      });
      return;
    }

    res.json({
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        failureCount: webhook.failureCount,
        lastSuccessAt: webhook.lastSuccessAt,
        lastFailureAt: webhook.lastFailureAt,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Error getting webhook: ${error}`, 'WebhookController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get webhook'
    });
  }
}

/**
 * Update webhook configuration
 * PUT /api/organizations/:orgId/webhooks/:webhookId
 */
export async function updateWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, webhookId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;
    const { url, events, status } = req.body;

    // Check permission
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'webhooks:manage' as any);
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to manage webhooks'
      });
      return;
    }

    // Verify webhook belongs to organization
    const existing = await storage.getWebhook(webhookId);
    if (!existing || existing.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Webhook not found'
      });
      return;
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch (error) {
        res.status(400).json({
          error: 'INVALID_URL',
          message: 'Invalid webhook URL format'
        });
        return;
      }
    }

    const updates: any = {};
    if (url) updates.url = url;
    if (events) updates.events = events;
    if (status) updates.status = status;

    const updated = await storage.updateWebhook(webhookId, updates);

    res.json({
      webhook: {
        id: updated.id,
        url: updated.url,
        events: updated.events,
        status: updated.status,
        updatedAt: updated.updatedAt
      }
    });
  } catch (error) {
    logger.error(`Error updating webhook: ${error}`, 'WebhookController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to update webhook'
    });
  }
}

/**
 * Delete webhook
 * DELETE /api/organizations/:orgId/webhooks/:webhookId
 */
export async function deleteWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, webhookId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check permission
    const hasPermission = await organizationService.hasPermission(orgId, userId, 'webhooks:manage' as any);
    if (!hasPermission) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to manage webhooks'
      });
      return;
    }

    // Verify webhook belongs to organization
    const webhook = await storage.getWebhook(webhookId);
    if (!webhook || webhook.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Webhook not found'
      });
      return;
    }

    await storage.deleteWebhook(webhookId);

    res.json({
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting webhook: ${error}`, 'WebhookController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to delete webhook'
    });
  }
}

/**
 * Test webhook endpoint
 * POST /api/organizations/:orgId/webhooks/:webhookId/test
 */
export async function testWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { orgId, webhookId } = req.params;
    const authReq = req as EnterpriseAuthRequest;
    const userId = authReq.user!.id;

    // Check membership
    const member = await organizationService.getOrganizationMember(orgId, userId);
    if (!member) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    // Get webhook
    const webhook = await storage.getWebhook(webhookId);
    if (!webhook || webhook.organizationId !== orgId) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Webhook not found'
      });
      return;
    }

    // Test the webhook
    const result = await webhookService.testWebhook(webhook.url, webhook.secret);

    res.json({
      success: result.success,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      error: result.error,
      message: result.success 
        ? 'Webhook endpoint is responding correctly'
        : 'Webhook endpoint test failed'
    });
  } catch (error) {
    logger.error(`Error testing webhook: ${error}`, 'WebhookController');
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to test webhook'
    });
  }
}
