-- ============================================================================
-- Phase 3 Migration: Atomic Bookings, Participant Manifests & Custom Enquiries
-- Database: tour_marketplace_db
-- ============================================================================

USE `tour_marketplace_db`;

-- ----------------------------------------------------------------------------
-- 10. CUSTOM TRIP ENQUIRIES TABLE (Category B: Private/Customizable Group Trips)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `custom_trip_enquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `enquiry_reference` VARCHAR(40) NOT NULL UNIQUE,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `preferred_start_date` DATE NOT NULL,
  `group_size` SMALLINT UNSIGNED NOT NULL,
  `budget_per_person` DECIMAL(10,2) NULL,
  `origin_city` VARCHAR(100) NOT NULL,
  `customization_notes` TEXT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `status` ENUM('OPEN', 'QUOTED', 'ACCEPTED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  `operator_quote_total` DECIMAL(12,2) NULL,
  `operator_response_notes` TEXT NULL,
  `responded_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_enquiries_operator_status` (`operator_id`, `status`),
  INDEX `idx_enquiries_user` (`user_id`),
  CONSTRAINT `fk_enquiries_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_enquiries_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_enquiries_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. BOOKINGS TABLE (Fixed-Departure Reservations & Unit Economics Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_reference` VARCHAR(40) NOT NULL UNIQUE,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `trip_id` BIGINT UNSIGNED NOT NULL,
  `departure_id` BIGINT UNSIGNED NOT NULL,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `seats_count` SMALLINT UNSIGNED NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL COMMENT 'GMV for this booking (seats_count * unit_price)',
  `payment_plan` ENUM('FULL', 'TOKEN') NOT NULL DEFAULT 'FULL',
  `token_amount_required` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amount_paid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `balance_due` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `commission_rate_pct` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `platform_commission_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `operator_payout_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `booking_status` ENUM(
    'PENDING_PAYMENT',
    'CONFIRMED',
    'CANCELLED_BY_USER',
    'CANCELLED_BY_OPERATOR',
    'EXPIRED',
    'COMPLETED'
  ) NOT NULL DEFAULT 'PENDING_PAYMENT',
  `hold_expires_at` DATETIME NULL COMMENT '15-minute seat lock window before payment confirmation',
  `special_requests` VARCHAR(500) NULL,
  `operator_remarks` VARCHAR(500) NULL,
  `cancelled_at` DATETIME NULL,
  `cancellation_reason` VARCHAR(500) NULL,
  `refund_amount_eligible` DECIMAL(12,2) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_bookings_user` (`user_id`),
  INDEX `idx_bookings_departure_status` (`departure_id`, `booking_status`),
  INDEX `idx_bookings_operator_status` (`operator_id`, `booking_status`),
  CONSTRAINT `fk_bookings_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_bookings_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_bookings_departure`
    FOREIGN KEY (`departure_id`) REFERENCES `trip_departures` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_bookings_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. BOOKING PARTICIPANTS TABLE (Passenger Manifest & Road-Trip Safety Info)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `booking_participants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT UNSIGNED NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `age` TINYINT UNSIGNED NOT NULL,
  `gender` ENUM('MALE', 'FEMALE', 'NON_BINARY', 'OTHER') NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `id_proof_type` ENUM('AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID') NOT NULL DEFAULT 'AADHAAR',
  `id_proof_number` VARCHAR(50) NULL,
  `driving_license_number` VARCHAR(50) NULL COMMENT 'For Bike/Car Expedition riders',
  `blood_group` VARCHAR(10) NULL,
  `medical_conditions` VARCHAR(255) NULL,
  `emergency_contact_name` VARCHAR(120) NOT NULL,
  `emergency_contact_phone` VARCHAR(20) NOT NULL,
  `is_primary_contact` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_participants_booking` (`booking_id`),
  CONSTRAINT `fk_participants_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
