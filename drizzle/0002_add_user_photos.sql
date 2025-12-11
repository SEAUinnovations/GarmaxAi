-- Add user_photos table for photo-based try-on workflow
-- This table stores user-uploaded photos for virtual try-on sessions
-- Maintains separation from user_avatars (3D avatar system)

CREATE TABLE IF NOT EXISTS `user_photos` (
  `id` VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `photo_url` TEXT NOT NULL,
  `photo_s3_key` TEXT NOT NULL,
  `thumbnail_url` TEXT,
  `photo_type` VARCHAR(20) NOT NULL DEFAULT 'front', -- 'front', 'side', 'full-body'
  `smpl_processed` BOOLEAN NOT NULL DEFAULT FALSE,
  `smpl_data_url` TEXT,
  `smpl_confidence` DECIMAL(5, 2),
  `smpl_metadata` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_photos_user_id` (`user_id`),
  INDEX `idx_user_photos_smpl_processed` (`smpl_processed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add photo_id column to tryon_sessions to support photo-based workflow
-- Keep avatar_id for backward compatibility (either photo_id OR avatar_id must be set)
ALTER TABLE `tryon_sessions` 
  ADD COLUMN `photo_id` VARCHAR(36) NULL AFTER `avatar_id`,
  ADD FOREIGN KEY (`photo_id`) REFERENCES `user_photos`(`id`) ON DELETE CASCADE;

-- Add index for photo_id lookups
ALTER TABLE `tryon_sessions`
  ADD INDEX `idx_tryon_sessions_photo_id` (`photo_id`);

-- Add check constraint to ensure either avatar_id or photo_id is set (MySQL 8.0.16+)
-- Note: This constraint may need adjustment based on MySQL version
ALTER TABLE `tryon_sessions`
  ADD CONSTRAINT `chk_tryon_sessions_source` 
  CHECK (
    (avatar_id IS NOT NULL AND photo_id IS NULL) OR 
    (avatar_id IS NULL AND photo_id IS NOT NULL)
  );
