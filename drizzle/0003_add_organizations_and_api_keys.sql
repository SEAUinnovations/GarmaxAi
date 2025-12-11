-- Organizations table for enterprise multi-user accounts
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `owner_id` VARCHAR(36) NOT NULL,
  `subscription_tier` VARCHAR(20) NOT NULL DEFAULT 'free',
  `stripe_customer_id` TEXT,
  `credits` INT NOT NULL DEFAULT 0,
  `api_rate_limit` INT NOT NULL DEFAULT 60,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `billing_email` VARCHAR(255),
  `company_website` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_organizations_owner_id` (`owner_id`),
  INDEX `idx_organizations_slug` (`slug`),
  INDEX `idx_organizations_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Organization members table
CREATE TABLE IF NOT EXISTS `organization_members` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `organization_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'member',
  `permissions` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_org_user` (`organization_id`, `user_id`),
  INDEX `idx_org_members_organization_id` (`organization_id`),
  INDEX `idx_org_members_user_id` (`user_id`),
  INDEX `idx_org_members_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API keys table for programmatic access
CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `organization_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `key_hash` TEXT NOT NULL,
  `key_prefix` VARCHAR(20) NOT NULL,
  `environment` VARCHAR(10) NOT NULL DEFAULT 'live',
  `scopes` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `rate_limit` INT,
  `last_used_at` TIMESTAMP,
  `request_count` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `expires_at` TIMESTAMP,
  `revoked_at` TIMESTAMP,
  `revoked_by` VARCHAR(36),
  `revoked_reason` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`revoked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_api_keys_organization_id` (`organization_id`),
  INDEX `idx_api_keys_user_id` (`user_id`),
  INDEX `idx_api_keys_key_prefix` (`key_prefix`),
  INDEX `idx_api_keys_status` (`status`),
  INDEX `idx_api_keys_environment` (`environment`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API key usage tracking table
CREATE TABLE IF NOT EXISTS `api_key_usage` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `api_key_id` VARCHAR(36) NOT NULL,
  `organization_id` VARCHAR(36) NOT NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `method` VARCHAR(10) NOT NULL,
  `status_code` INT NOT NULL,
  `credits_used` INT NOT NULL DEFAULT 0,
  `processing_time_ms` INT,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `error_message` TEXT,
  `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  INDEX `idx_api_key_usage_api_key_id` (`api_key_id`),
  INDEX `idx_api_key_usage_organization_id` (`organization_id`),
  INDEX `idx_api_key_usage_timestamp` (`timestamp`),
  INDEX `idx_api_key_usage_endpoint` (`endpoint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- External customers table for e-commerce integration
CREATE TABLE IF NOT EXISTS `external_customers` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `organization_id` VARCHAR(36) NOT NULL,
  `external_customer_id` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255),
  `first_name` VARCHAR(100),
  `last_name` VARCHAR(100),
  `photo_urls` JSON,
  `metadata` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_org_external_customer` (`organization_id`, `external_customer_id`),
  INDEX `idx_external_customers_organization_id` (`organization_id`),
  INDEX `idx_external_customers_external_id` (`external_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cart try-on sessions for checkout workflow integration
CREATE TABLE IF NOT EXISTS `cart_tryon_sessions` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `organization_id` VARCHAR(36) NOT NULL,
  `external_customer_id` VARCHAR(36) NOT NULL,
  `cart_id` VARCHAR(255) NOT NULL,
  `cart_items` JSON NOT NULL,
  `customer_photo_url` TEXT NOT NULL,
  `customer_photo_s3_key` TEXT NOT NULL,
  `render_quality` VARCHAR(10) NOT NULL DEFAULT 'hd',
  `background_scene` VARCHAR(50) NOT NULL DEFAULT 'studio',
  `status` VARCHAR(30) NOT NULL DEFAULT 'queued',
  `progress` INT NOT NULL DEFAULT 0,
  `rendered_image_url` TEXT,
  `webhook_url` TEXT,
  `webhook_delivered` BOOLEAN NOT NULL DEFAULT FALSE,
  `webhook_delivered_at` TIMESTAMP,
  `credits_used` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`external_customer_id`) REFERENCES `external_customers`(`id`) ON DELETE CASCADE,
  INDEX `idx_cart_tryon_organization_id` (`organization_id`),
  INDEX `idx_cart_tryon_external_customer_id` (`external_customer_id`),
  INDEX `idx_cart_tryon_cart_id` (`cart_id`),
  INDEX `idx_cart_tryon_status` (`status`),
  INDEX `idx_cart_tryon_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook configurations for partner notifications
CREATE TABLE IF NOT EXISTS `webhook_configurations` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `organization_id` VARCHAR(36) NOT NULL,
  `url` TEXT NOT NULL,
  `secret` TEXT NOT NULL,
  `events` JSON NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `failure_count` INT NOT NULL DEFAULT 0,
  `last_failure_at` TIMESTAMP,
  `last_success_at` TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
  INDEX `idx_webhook_configs_organization_id` (`organization_id`),
  INDEX `idx_webhook_configs_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
