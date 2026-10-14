-- ============================================================================
-- Unified Travel Marketplace & Operator Infrastructure - Database Schema
-- Database: tour_marketplace_db
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `tour_marketplace_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tour_marketplace_db`;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE (Travelers, Operators, Platform Admins)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(160) NULL UNIQUE,
  `phone` VARCHAR(20) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NULL,
  `role` ENUM('TRAVELER', 'OPERATOR', 'ADMIN') NOT NULL DEFAULT 'TRAVELER',
  `avatar_url` VARCHAR(500) NULL,
  `is_phone_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_email_verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `last_login_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. OTP VERIFICATIONS TABLE (Mobile OTP Login & Verification)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `otp_verifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `phone` VARCHAR(20) NOT NULL,
  `otp_code` VARCHAR(10) NOT NULL,
  `purpose` ENUM('LOGIN', 'REGISTER', 'RESET_PASSWORD') NOT NULL DEFAULT 'LOGIN',
  `expires_at` DATETIME NOT NULL,
  `is_used` BOOLEAN NOT NULL DEFAULT FALSE,
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_otp_phone_expires` (`phone`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. TRAVELER PREFERENCES (Model B - Travel Compatibility & Vibe Profile)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `traveler_preferences` (
  `user_id` BIGINT UNSIGNED NOT NULL,
  `pace_preference` ENUM('RELAXED', 'BALANCED', 'HIGH_ADVENTURE') NOT NULL DEFAULT 'BALANCED',
  `morning_style` ENUM('EARLY_BIRD', 'FLEXIBLE', 'LEISURELY') NOT NULL DEFAULT 'FLEXIBLE',
  `social_style` ENUM('QUIET_EXPLORATION', 'BALANCED_SOCIAL', 'HIGH_ENERGY_GROUP') NOT NULL DEFAULT 'BALANCED_SOCIAL',
  `comfort_preference` ENUM('BUDGET_BACKPACKER', 'STANDARD_COMFORT', 'PREMIUM_BOUTIQUE') NOT NULL DEFAULT 'STANDARD_COMFORT',
  `preferred_trip_types` JSON NULL COMMENT 'Array of categories e.g. ["STRANGER_GROUP", "BIKE_CAR_EXPEDITION"]',
  `age_bracket` ENUM('18_24', '25_30', '31_40', '40_PLUS') NULL,
  `gender` ENUM('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY') NULL,
  `home_city` VARCHAR(100) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_traveler_pref_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. OPERATORS TABLE (Supply-Side Organizers, Communities & Agencies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operators` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL UNIQUE,
  `business_name` VARCHAR(160) NOT NULL,
  `slug` VARCHAR(180) NOT NULL UNIQUE,
  `tagline` VARCHAR(255) NULL,
  `bio` TEXT NULL,
  `operator_type` ENUM('INDIVIDUAL_ORGANIZER', 'TRAVEL_COMMUNITY', 'REGISTERED_AGENCY', 'BIKER_CLUB') NOT NULL DEFAULT 'TRAVEL_COMMUNITY',
  `base_city` VARCHAR(100) NOT NULL,
  `operating_regions` JSON NULL COMMENT 'e.g. ["Himachal", "Ladakh", "Madhya Pradesh", "Rajasthan"]',
  `instagram_handle` VARCHAR(100) NULL,
  `website_url` VARCHAR(255) NULL,
  `support_email` VARCHAR(160) NULL,
  `support_phone` VARCHAR(20) NOT NULL,
  `emergency_contact_phone` VARCHAR(20) NOT NULL,
  `gst_number` VARCHAR(25) NULL,
  `pan_number` VARCHAR(20) NULL,
  `kyc_documents` JSON NULL COMMENT 'URLs/metadata for registration proof, PAN, liability insurance',
  `kyc_status` ENUM('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `kyc_rejection_reason` VARCHAR(500) NULL,
  `verified_at` DATETIME NULL,
  `verified_by_admin_id` BIGINT UNSIGNED NULL,
  `commission_rate_pct` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `rating_avg` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `reviews_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `total_completed_trips` INT UNSIGNED NOT NULL DEFAULT 0,
  `cancellation_rate_pct` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_operators_kyc_status` (`kyc_status`),
  INDEX `idx_operators_base_city` (`base_city`),
  CONSTRAINT `fk_operators_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_operators_verified_by`
    FOREIGN KEY (`verified_by_admin_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. OPERATOR VERIFICATION AUDIT LOGS (Trust & Safety Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operator_verification_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `admin_id` BIGINT UNSIGNED NOT NULL,
  `previous_status` VARCHAR(30) NOT NULL,
  `new_status` VARCHAR(30) NOT NULL,
  `remarks` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ovl_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_ovl_admin`
    FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. TRIPS TABLE (Core Trip Packages Across All 4 Categories)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trips` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(220) NOT NULL UNIQUE,
  `trip_category` ENUM('STRANGER_GROUP', 'PRIVATE_GROUP', 'BIKE_CAR_EXPEDITION', 'WEEKEND_NICHE') NOT NULL,
  `experience_type` VARCHAR(80) NOT NULL COMMENT 'e.g. Trekking, Motorcycle Expedition, Camping, Backpacking, Heritage',
  `origin_city` VARCHAR(100) NOT NULL,
  `destination_city` VARCHAR(100) NOT NULL,
  `state_or_country` VARCHAR(100) NOT NULL DEFAULT 'India',
  `duration_days` SMALLINT UNSIGNED NOT NULL,
  `duration_nights` SMALLINT UNSIGNED NOT NULL,
  `base_price` DECIMAL(10,2) NOT NULL,
  `comfort_level` ENUM('BUDGET', 'STANDARD', 'PREMIUM') NOT NULL DEFAULT 'STANDARD',
  `difficulty_level` ENUM('EASY', 'MODERATE', 'CHALLENGING', 'EXTREME') NOT NULL DEFAULT 'MODERATE',
  `accommodation_type` ENUM('CAMPING', 'HOSTEL', 'HOTEL', 'BOUTIQUE_STAY', 'MIXED') NOT NULL DEFAULT 'MIXED',
  `pace_tag` ENUM('RELAXED', 'BALANCED', 'HIGH_ADVENTURE') NOT NULL DEFAULT 'BALANCED',
  `vibe_tags` JSON NULL COMMENT 'e.g. ["Solo Friendly", "Bonfire Nights", "Scenic Ride"]',
  `highlights` JSON NULL,
  `inclusions` JSON NOT NULL,
  `exclusions` JSON NOT NULL,
  `cancellation_policy` JSON NOT NULL COMMENT 'Structured tiers: >15d, 7-15d, <7d, operator_cancel_refund_pct',
  `safety_and_permits` JSON NULL COMMENT 'Backup vehicle, mechanic, oxygen cylinder, inner line permits, insurance',
  `is_customizable_private` BOOLEAN NOT NULL DEFAULT FALSE,
  `status` ENUM('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_trips_category_status` (`trip_category`, `status`),
  INDEX `idx_trips_origin_dest` (`origin_city`, `destination_city`),
  INDEX `idx_trips_price` (`base_price`),
  CONSTRAINT `fk_trips_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. TRIP ITINERARIES TABLE (Day-by-Day Breakdown)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trip_itineraries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `day_number` SMALLINT UNSIGNED NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `meals_included` VARCHAR(100) NULL COMMENT 'e.g. Breakfast, Dinner',
  `accommodation_details` VARCHAR(200) NULL,
  `travel_distance_km` SMALLINT UNSIGNED NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_trip_day` (`trip_id`, `day_number`),
  CONSTRAINT `fk_itinerary_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. TRIP DEPARTURES TABLE (Departure-Confidence & Live Seat Inventory)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `trip_departures` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `batch_code` VARCHAR(50) NOT NULL UNIQUE,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `price_per_person` DECIMAL(10,2) NOT NULL,
  `token_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total_seats` SMALLINT UNSIGNED NOT NULL,
  `booked_seats` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Seats booked via platform',
  `offline_blocked_seats` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Seats filled via Instagram/offline by operator',
  `min_group_size` SMALLINT UNSIGNED NOT NULL DEFAULT 6 COMMENT 'Minimum seats needed to guarantee departure',
  `booking_deadline` DATETIME NOT NULL,
  `departure_status` ENUM('OPEN', 'GUARANTEED', 'FILLING_FAST', 'SOLD_OUT', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
  `inventory_last_confirmed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_departures_dates_status` (`start_date`, `departure_status`),
  CONSTRAINT `fk_departures_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
