-- Migration: Add payment tracking tables and update trial period
-- Date: 2025-12-11
-- Description: Adds payment_transactions and credit_purchases tables, plus autoConvertToPlan field

-- Add autoConvertToPlan field to users table
ALTER TABLE users 
ADD COLUMN auto_convert_to_plan VARCHAR(20) DEFAULT 'studio' COMMENT 'Plan to convert to after trial (studio/pro)';

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  type ENUM('subscription', 'credit_purchase', 'refund', 'chargeback') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL COMMENT 'Amount in USD',
  credits_amount INT DEFAULT NULL COMMENT 'Credits added/refunded (if applicable)',
  stripe_payment_id VARCHAR(255) DEFAULT NULL,
  stripe_invoice_id VARCHAR(255) DEFAULT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  metadata JSON DEFAULT NULL COMMENT 'Additional transaction details',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_transactions (user_id, created_at DESC),
  INDEX idx_stripe_payment (stripe_payment_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create credit_purchases table
CREATE TABLE IF NOT EXISTS credit_purchases (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(36) NOT NULL,
  credits_purchased INT NOT NULL,
  bonus_credits INT NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10, 2) NOT NULL COMMENT 'Amount in USD',
  stripe_session_id VARCHAR(255) DEFAULT NULL,
  stripe_payment_intent_id VARCHAR(255) DEFAULT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP DEFAULT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_purchases (user_id, created_at DESC),
  INDEX idx_stripe_session (stripe_session_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Update default trial period from 7 days to 2 days (handled in application code)
-- Note: Existing users keep their current trialExpiresAt values
