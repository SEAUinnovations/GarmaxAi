-- Migration: Add gemini_batch_jobs table for Gemini Imagen 3 batch processing
-- Created: 2025-12-01
-- Purpose: Track batch image generation requests to Google Gemini API for cost optimization

-- Create gemini_batch_jobs table
CREATE TABLE IF NOT EXISTS `gemini_batch_jobs` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  
  -- User and batch identification
  `user_id` VARCHAR(36) NOT NULL,
  `batch_id` TEXT NOT NULL,
  
  -- Request tracking (JSON array of request IDs)
  `request_ids` JSON NOT NULL,
  
  -- Batch status: pending -> submitted -> processing -> completed | failed
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  
  -- Timestamps for tracking batch progression
  `submitted_at` TIMESTAMP NULL,
  `completed_at` TIMESTAMP NULL,
  
  -- Gemini API details
  `gemini_batch_url` TEXT NULL,
  
  -- Cost tracking for budget controls
  `cost_usd` DECIMAL(10, 4) NULL,
  `image_count` INT NOT NULL,
  
  -- Error tracking
  `error_message` TEXT NULL,
  `retry_count` INT NOT NULL DEFAULT 0,
  
  -- Standard timestamps
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT `fk_gemini_batch_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for efficient querying

-- Index for finding batches by user (for quota tracking and user dashboards)
CREATE INDEX `idx_gemini_batch_user_id` ON `gemini_batch_jobs`(`user_id`);

-- Composite index for monitoring pending/processing batches (batch orchestrator queries)
CREATE INDEX `idx_gemini_batch_status_submitted` ON `gemini_batch_jobs`(`status`, `submitted_at`);

-- Index for cost analysis and budget tracking queries
CREATE INDEX `idx_gemini_batch_user_status` ON `gemini_batch_jobs`(`user_id`, `status`);

-- Index for finding batches by Gemini batch_id (webhook processing)
CREATE INDEX `idx_gemini_batch_batch_id` ON `gemini_batch_jobs`(`batch_id`(255));

-- Add comment to table for documentation
ALTER TABLE `gemini_batch_jobs` COMMENT = 'Tracks batch image generation requests to Google Gemini Imagen 3 API. Used for cost optimization by grouping multiple render requests into single API calls. Supports hybrid batching strategy (max 50 images OR 45s timeout).';
