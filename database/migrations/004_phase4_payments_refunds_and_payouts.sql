-- ============================================================================
-- Phase 4 Migration: Online Payments, Policy Refunds & Operator Escrow Payouts
-- Database: tour_marketplace_db
-- ============================================================================

USE `tour_marketplace_db`;

-- ----------------------------------------------------------------------------
-- 13. PAYMENTS TABLE (Razorpay Orders, Captures & Balance Settlements)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `booking_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `payment_purpose` ENUM('INITIAL_BOOKING', 'BALANCE_SETTLEMENT') NOT NULL DEFAULT 'INITIAL_BOOKING',
  `gateway_provider` ENUM('RAZORPAY', 'MANUAL_UPI') NOT NULL DEFAULT 'RAZORPAY',
  `gateway_order_id` VARCHAR(80) NOT NULL UNIQUE,
  `gateway_payment_id` VARCHAR(80) NULL,
  `gateway_signature` VARCHAR(255) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `gateway_fee_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Estimated ~2% payment gateway processing fee',
  `status` ENUM('CREATED', 'CAPTURED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
  `paid_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_payments_booking_status` (`booking_id`, `status`),
  INDEX `idx_payments_user` (`user_id`),
  CONSTRAINT `fk_payments_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_payments_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 14. REFUNDS TABLE (Policy-Driven Traveler Refunds & 100% Operator Batch Cancel Refunds)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `refund_reference` VARCHAR(40) NOT NULL UNIQUE,
  `booking_id` BIGINT UNSIGNED NOT NULL,
  `payment_id` BIGINT UNSIGNED NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `initiated_by` ENUM('TRAVELER', 'OPERATOR', 'ADMIN') NOT NULL,
  `days_before_departure` INT NOT NULL,
  `policy_tier_applied` VARCHAR(100) NOT NULL,
  `amount_paid_snapshot` DECIMAL(12,2) NOT NULL,
  `refund_percentage` DECIMAL(5,2) NOT NULL,
  `refund_amount` DECIMAL(12,2) NOT NULL,
  `gateway_refund_id` VARCHAR(80) NULL,
  `status` ENUM('PENDING', 'PROCESSED', 'NO_REFUND_ELIGIBLE', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `reason` VARCHAR(500) NULL,
  `processed_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_refunds_booking` (`booking_id`),
  INDEX `idx_refunds_user` (`user_id`),
  CONSTRAINT `fk_refunds_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_refunds_payment`
    FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`)
    ON DELETE SET NULL,
  CONSTRAINT `fk_refunds_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_refunds_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. OPERATOR PAYOUTS TABLE (Escrow Protection & Post-Departure Settlement Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `operator_payouts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payout_reference` VARCHAR(40) NOT NULL UNIQUE,
  `booking_id` BIGINT UNSIGNED NOT NULL UNIQUE,
  `departure_id` BIGINT UNSIGNED NOT NULL,
  `operator_id` BIGINT UNSIGNED NOT NULL,
  `gross_booking_amount` DECIMAL(12,2) NOT NULL,
  `amount_collected` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `platform_commission_pct` DECIMAL(5,2) NOT NULL,
  `platform_commission_amount` DECIMAL(12,2) NOT NULL,
  `gateway_fee_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `net_operator_payable` DECIMAL(12,2) NOT NULL,
  `payout_status` ENUM(
    'ESCROW_HELD',
    'ELIGIBLE_FOR_RELEASE',
    'SETTLED',
    'CANCELLED_FORFEITED'
  ) NOT NULL DEFAULT 'ESCROW_HELD',
  `settlement_utr_number` VARCHAR(80) NULL,
  `settled_by_admin_id` BIGINT UNSIGNED NULL,
  `settled_at` DATETIME NULL,
  `remarks` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_payouts_operator_status` (`operator_id`, `payout_status`),
  INDEX `idx_payouts_departure` (`departure_id`),
  CONSTRAINT `fk_payouts_booking`
    FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_payouts_departure`
    FOREIGN KEY (`departure_id`) REFERENCES `trip_departures` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_payouts_operator`
    FOREIGN KEY (`operator_id`) REFERENCES `operators` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_payouts_admin`
    FOREIGN KEY (`settled_by_admin_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
