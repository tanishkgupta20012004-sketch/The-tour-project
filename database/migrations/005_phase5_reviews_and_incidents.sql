-- ============================================================================
-- Phase 5 Migration: Verified Multi-Dimensional Reviews & Safety/SOS Incidents
-- Database: tour_marketplace_db
-- ============================================================================

USE `tour_marketplace_db`;

-- ----------------------------------------------------------------------------
-- 16. REVIEWS TABLE (Strictly Verified-Only Post-Booking Reviews)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT UNSIGNED NOT NULL UNIQUE COMMENT '1 review per verified booking',
  `user_id` BIGINT UNSIGNED NOT NULL,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `departure_id` BIGINT UNSIGNED NOT NULL,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `overall_rating` TINYINT UNSIGNED NOT NULL,
  `itinerary_accuracy_rating` TINYINT UNSIGNED NOT NULL,
  `safety_and_captain_rating` TINYINT UNSIGNED NOT NULL,
  `accommodation_and_food_rating` TINYINT UNSIGNED NOT NULL,
  `group_vibe_rating` TINYINT UNSIGNED NOT NULL,
  `review_title` VARCHAR(160) NOT NULL,
  `review_text` TEXT NOT NULL,
  `operator_public_reply` TEXT NULL,
  `operator_replied_at` DATETIME NULL,
  `is_verified_booking` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_reviews_trip` (`trip_id`),
  INDEX `idx_reviews_operator` (`operator_id`),
  CONSTRAINT `fk_reviews_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_departure`
    FOREIGN KEY (`departure_id`) REFERENCES `trip_departures` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 17. TRIP INCIDENTS TABLE (Safety, SOS & Quality Dispute Resolution + Escrow Freeze)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trip_incidents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `incident_reference` VARCHAR(40) NOT NULL UNIQUE,
  `booking_id` BIGINT UNSIGNED NOT NULL,
  `departure_id` BIGINT UNSIGNED NOT NULL,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `reported_by_user_id` BIGINT UNSIGNED NOT NULL,
  `incident_category` ENUM(
    'SUBSTANDARD_ACCOMMODATION',
    'ITINERARY_MISREPRESENTATION',
    'VEHICLE_OR_SAFETY_HAZARD',
    'HARASSMENT_OR_GROUP_BEHAVIOR',
    'MEDICAL_OR_SOS_EMERGENCY',
    'OPERATOR_UNRESPONSIVE'
  ) NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL_SOS') NOT NULL DEFAULT 'MEDIUM',
  `description` TEXT NOT NULL,
  `evidence_urls` JSON NULL,
  `payout_frozen` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'True if escrow payout was frozen due to HIGH/CRITICAL incident',
  `status` ENUM(
    'OPEN',
    'INVESTIGATING',
    'RESOLVED_TRAVELER_COMPENSATED',
    'RESOLVED_NO_FAULT',
    'DISMISSED'
  ) NOT NULL DEFAULT 'OPEN',
  `operator_explanation` TEXT NULL,
  `admin_resolution_notes` TEXT NULL,
  `resolved_by_admin_id` BIGINT UNSIGNED NULL,
  `resolved_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_incidents_operator_status` (`operator_id`, `status`),
  INDEX `idx_incidents_booking` (`booking_id`),
  CONSTRAINT `fk_incidents_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_incidents_departure`
    FOREIGN KEY (`departure_id`) REFERENCES `trip_departures` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_incidents_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_incidents_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_incidents_reporter`
    FOREIGN KEY (`reported_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_incidents_admin`
    FOREIGN KEY (`resolved_by_admin_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
