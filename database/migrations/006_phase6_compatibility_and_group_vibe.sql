-- ============================================================================
-- Phase 6 Migration: Travel Compatibility Profiles & Group Vibe Insights
-- Database: tour_marketplace_db
-- ============================================================================

USE `tour_marketplace_db`;

-- ----------------------------------------------------------------------------
-- 18. TRIP COMPATIBILITY PROFILES TABLE (Model B & Modification 2)
-- Stores structured pace, schedule, and social vibe metadata for each trip
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trip_compatibility_profiles` (
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `ideal_morning_style` ENUM('EARLY_BIRD', 'FLEXIBLE', 'LEISURELY') NOT NULL DEFAULT 'FLEXIBLE',
  `ideal_social_style` ENUM('QUIET_EXPLORATION', 'BALANCED_SOCIAL', 'HIGH_ENERGY_GROUP') NOT NULL DEFAULT 'BALANCED_SOCIAL',
  `solo_traveler_friendly` BOOLEAN NOT NULL DEFAULT TRUE,
  `ideal_age_brackets` JSON NULL COMMENT 'e.g. ["18_24", "25_30", "31_40"]',
  `activity_intensity_level` TINYINT UNSIGNED NOT NULL DEFAULT 3 COMMENT 'Scale of 1 (Relaxed) to 5 (Extreme)',
  `group_vibe_summary` VARCHAR(255) NULL COMMENT 'e.g. High-energy backpackers, acoustic bonfire nights & early mountain starts',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`trip_id`),
  CONSTRAINT `fk_compat_profile_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
