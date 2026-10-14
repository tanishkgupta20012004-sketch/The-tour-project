-- ============================================================================
-- Phase 2 Migration: Departure Waitlist / Interest & Discovery Indexes
-- Database: tour_marketplace_db
-- ============================================================================

USE `tour_marketplace_db`;

-- ----------------------------------------------------------------------------
-- 9. DEPARTURE WAITLIST / INTEREST TABLE (Modification 5: Departure Confidence)
-- Allows travelers to register interest in a departure before paying or when sold out
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `departure_waitlist` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `departure_id` BIGINT UNSIGNED NOT NULL,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `seats_interested` SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  `interest_type` ENUM('WAIT_FOR_GUARANTEE', 'WAIT_FOR_SEAT_OPENING', 'PRICE_DROP_ALERT') NOT NULL DEFAULT 'WAIT_FOR_GUARANTEE',
  `notes` VARCHAR(300) NULL,
  `is_notified` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_departure_user_interest` (`departure_id`, `user_id`),
  INDEX `idx_waitlist_trip` (`trip_id`),
  CONSTRAINT `fk_waitlist_departure`
    FOREIGN KEY (`departure_id`) REFERENCES `trip_departures` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_waitlist_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_waitlist_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
