import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { computeDepartureStatus, formatDepartureConfidence } from '../departures/departure.utils.js';
import { calculateCancellationRefund } from '../payments/payment.utils.js';
import {
  cancelBookingSchema,
  confirmManualBookingSchema,
  createCustomEnquirySchema,
  quoteCustomEnquirySchema,
  reserveSeatsSchema
} from './booking.validation.js';

function generateReference(prefix = 'BK') {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${datePart}-${randomPart}`;
}

export const reserveSeats = asyncHandler(async (req, res) => {
  const payload = reserveSeatsSchema.parse(req.body);
  const seatsRequested = payload.participants.length;

  const connection = await pool.getConnection();
  let bookingId;
  let bookingReference;
  let updatedDepartureRow;

  try {
    await connection.beginTransaction();

    // 1. Atomic Row Lock (FOR UPDATE) on trip_departures to prevent overbooking
    const [depRows] = await connection.query(
      `SELECT
         td.*,
         t.operator_id, t.title AS trip_title, t.slug AS trip_slug, t.trip_category,
         o.commission_rate_pct
       FROM trip_departures td
       JOIN trips t ON t.id = td.trip_id
       JOIN operators o ON o.id = t.operator_id
       WHERE td.id = ?
       FOR UPDATE`,
      [payload.departure_id]
    );

    if (!depRows.length) {
      throw new ApiError(404, 'Departure batch not found.');
    }

    const dep = depRows[0];

    if (['CANCELLED', 'COMPLETED'].includes(dep.departure_status)) {
      throw new ApiError(400, `Cannot book a departure with status ${dep.departure_status}.`);
    }

    const availableSeats =
      Number(dep.total_seats) - Number(dep.booked_seats) - Number(dep.offline_blocked_seats);

    if (availableSeats < seatsRequested) {
      throw new ApiError(
        409,
        `Insufficient seats available. Requested: ${seatsRequested}, Available: ${Math.max(
          0,
          availableSeats
        )}.`
      );
    }

    // 2. Road-trip safety check (Problem 2: Verify licensing for Bike/Car Expeditions)
    if (dep.trip_category === 'BIKE_CAR_EXPEDITION') {
      const hasLicensedRider = payload.participants.some(
        (p) => p.driving_license_number && p.driving_license_number.trim().length >= 5
      );
      if (!hasLicensedRider) {
        throw new ApiError(
          400,
          'Bike & Car Expeditions require at least one participant with a valid driving_license_number.'
        );
      }
    }

    // 3. Calculate Marketplace Unit Economics (GMV, Token, Commission, Net Operator Payout)
    const unitPrice = Number(dep.price_per_person);
    const totalAmount = Number((unitPrice * seatsRequested).toFixed(2));
    const perSeatToken =
      Number(dep.token_amount) > 0 ? Number(dep.token_amount) : Number((unitPrice * 0.25).toFixed(2));
    const tokenAmountRequired = Number((perSeatToken * seatsRequested).toFixed(2));
    const commissionRatePct = Number(dep.commission_rate_pct || 10);
    const platformCommissionAmount = Number(((totalAmount * commissionRatePct) / 100).toFixed(2));
    const operatorPayoutAmount = Number((totalAmount - platformCommissionAmount).toFixed(2));

    bookingReference = generateReference('BK');

    // 4. Insert Booking Record (15-minute payment hold window)
    const [insertBooking] = await connection.query(
      `INSERT INTO bookings (
         booking_reference, user_id, trip_id, departure_id, operator_id,
         seats_count, unit_price, total_amount, payment_plan,
         token_amount_required, amount_paid, balance_due,
         commission_rate_pct, platform_commission_amount, operator_payout_amount,
         booking_status, hold_expires_at, special_requests
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, 0.00, ?,
         ?, ?, ?,
         'PENDING_PAYMENT', DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?
       )`,
      [
        bookingReference,
        req.user.id,
        dep.trip_id,
        dep.id,
        dep.operator_id,
        seatsRequested,
        unitPrice,
        totalAmount,
        payload.payment_plan,
        tokenAmountRequired,
        totalAmount,
        commissionRatePct,
        platformCommissionAmount,
        operatorPayoutAmount,
        payload.special_requests || null
      ]
    );
    bookingId = insertBooking.insertId;

    // 5. Insert Participant Manifest Rows
    for (let i = 0; i < payload.participants.length; i++) {
      const p = payload.participants[i];
      await connection.query(
        `INSERT INTO booking_participants (
           booking_id, full_name, age, gender, phone,
           id_proof_type, id_proof_number, driving_license_number,
           blood_group, medical_conditions,
           emergency_contact_name, emergency_contact_phone, is_primary_contact
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bookingId,
          p.full_name,
          p.age,
          p.gender,
          p.phone,
          p.id_proof_type || 'AADHAAR',
          p.id_proof_number || null,
          p.driving_license_number || null,
          p.blood_group || null,
          p.medical_conditions || null,
          p.emergency_contact_name,
          p.emergency_contact_phone,
          i === 0 ? true : Boolean(p.is_primary_contact)
        ]
      );
    }

    // 6. Atomically increment booked_seats and recalculate Departure-Confidence status
    const newBookedSeats = Number(dep.booked_seats) + seatsRequested;
    const newDepartureStatus = computeDepartureStatus({
      total_seats: dep.total_seats,
      booked_seats: newBookedSeats,
      offline_blocked_seats: dep.offline_blocked_seats,
      min_group_size: dep.min_group_size,
      current_status: dep.departure_status
    });

    await connection.query(
      `UPDATE trip_departures
       SET booked_seats = ?,
           departure_status = ?,
           inventory_last_confirmed_at = NOW()
       WHERE id = ?`,
      [newBookedSeats, newDepartureStatus, dep.id]
    );

    const [updatedDep] = await connection.query(
      'SELECT * FROM trip_departures WHERE id = ? LIMIT 1',
      [dep.id]
    );
    updatedDepartureRow = updatedDep[0];

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [bookingRows] = await pool.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [
    bookingId
  ]);
  const [participantRows] = await pool.query(
    'SELECT * FROM booking_participants WHERE booking_id = ? ORDER BY id ASC',
    [bookingId]
  );

  const booking = bookingRows[0];
  const payableNow =
    booking.payment_plan === 'TOKEN' ? booking.token_amount_required : booking.total_amount;

  return res.status(201).json(
    new ApiResponse(201, 'Seats reserved atomically. Proceed to payment or manual confirmation.', {
      booking,
      payable_now_amount: payableNow,
      participants: participantRows,
      departure_confidence: formatDepartureConfidence(updatedDepartureRow).confidence_metrics
    })
  );
});

export const getMyBookings = asyncHandler(async (req, res) => {
  const [bookings] = await pool.query(
    `SELECT
       b.*,
       t.title AS trip_title, t.slug AS trip_slug, t.trip_category,
       t.origin_city, t.destination_city,
       td.batch_code, td.start_date, td.end_date, td.departure_status,
       o.business_name AS operator_name, o.support_phone AS operator_support_phone
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN trip_departures td ON td.id = b.departure_id
     JOIN operators o ON o.id = b.operator_id
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC`,
    [req.user.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Traveler bookings fetched successfully', {
      count: bookings.length,
      bookings
    })
  );
});

export const getBookingByReference = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  const [rows] = await pool.query(
    `SELECT
       b.*,
       t.title AS trip_title, t.slug AS trip_slug, t.trip_category,
       t.origin_city, t.destination_city, t.cancellation_policy,
       td.batch_code, td.start_date, td.end_date, td.departure_status,
       o.user_id AS operator_user_id, o.business_name AS operator_name,
       o.support_phone AS operator_support_phone, o.emergency_contact_phone AS operator_emergency_phone
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN trip_departures td ON td.id = b.departure_id
     JOIN operators o ON o.id = b.operator_id
     WHERE b.booking_reference = ?
     LIMIT 1`,
    [reference]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Booking not found.');
  }

  const booking = rows[0];
  if (
    req.user.role !== 'ADMIN' &&
    booking.user_id !== req.user.id &&
    booking.operator_user_id !== req.user.id
  ) {
    throw new ApiError(403, 'You do not have permission to view this booking.');
  }

  const [participants] = await pool.query(
    'SELECT * FROM booking_participants WHERE booking_id = ? ORDER BY id ASC',
    [booking.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Booking details & participant manifest fetched', {
      booking,
      participants
    })
  );
});

export const createCustomEnquiry = asyncHandler(async (req, res) => {
  const payload = createCustomEnquirySchema.parse(req.body);

  const [tripRows] = await pool.query(
    'SELECT id, operator_id, title, is_customizable_private FROM trips WHERE id = ? LIMIT 1',
    [payload.trip_id]
  );

  if (!tripRows.length) {
    throw new ApiError(404, 'Trip package not found.');
  }

  const trip = tripRows[0];
  const enquiryRef = generateReference('ENQ');

  const [result] = await pool.query(
    `INSERT INTO custom_trip_enquiries (
       enquiry_reference, user_id, trip_id, operator_id,
       preferred_start_date, group_size, budget_per_person,
       origin_city, customization_notes, contact_phone, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      enquiryRef,
      req.user.id,
      trip.id,
      trip.operator_id,
      payload.preferred_start_date,
      payload.group_size,
      payload.budget_per_person ?? null,
      payload.origin_city,
      payload.customization_notes || null,
      payload.contact_phone
    ]
  );

  const [rows] = await pool.query(
    'SELECT * FROM custom_trip_enquiries WHERE id = ? LIMIT 1',
    [result.insertId]
  );

  return res.status(201).json(
    new ApiResponse(
      201,
      'Custom private trip enquiry submitted to the operator.',
      rows[0]
    )
  );
});

export const getMyEnquiries = asyncHandler(async (req, res) => {
  const [enquiries] = await pool.query(
    `SELECT
       e.*,
       t.title AS trip_title, t.slug AS trip_slug,
       o.business_name AS operator_name, o.support_phone AS operator_support_phone
     FROM custom_trip_enquiries e
     JOIN trips t ON t.id = e.trip_id
     JOIN operators o ON o.id = e.operator_id
     WHERE e.user_id = ?
     ORDER BY e.created_at DESC`,
    [req.user.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Traveler custom enquiries fetched', {
      count: enquiries.length,
      enquiries
    })
  );
});

// ============================================================================
// OPERATOR B2B BOOKING & ENQUIRY MANAGEMENT ENDPOINTS
// ============================================================================

export const getOperatorBookings = asyncHandler(async (req, res) => {
  const { departure_id, booking_status, trip_id } = req.query;

  const [opRows] = await pool.query('SELECT id FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!opRows.length && req.user.role !== 'ADMIN') {
    throw new ApiError(404, 'Operator profile not found.');
  }

  const conditions = [];
  const params = [];

  if (req.user.role !== 'ADMIN') {
    conditions.push('b.operator_id = ?');
    params.push(opRows[0].id);
  }
  if (departure_id) {
    conditions.push('b.departure_id = ?');
    params.push(Number(departure_id));
  }
  if (trip_id) {
    conditions.push('b.trip_id = ?');
    params.push(Number(trip_id));
  }
  if (booking_status) {
    conditions.push('b.booking_status = ?');
    params.push(booking_status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [bookings] = await pool.query(
    `SELECT
       b.*,
       u.full_name AS booked_by_name, u.phone AS booked_by_phone, u.email AS booked_by_email,
       t.title AS trip_title,
       td.batch_code, td.start_date, td.end_date
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN trips t ON t.id = b.trip_id
     JOIN trip_departures td ON td.id = b.departure_id
     ${whereClause}
     ORDER BY b.created_at DESC`,
    params
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator bookings fetched successfully', {
      count: bookings.length,
      bookings
    })
  );
});

export const confirmManualBooking = asyncHandler(async (req, res) => {
  const bookingId = Number(req.params.id);
  const { amount_received, operator_remarks } = confirmManualBookingSchema.parse(req.body);

  const [rows] = await pool.query(
    `SELECT b.*, o.user_id AS operator_user_id
     FROM bookings b
     JOIN operators o ON o.id = b.operator_id
     WHERE b.id = ?
     LIMIT 1`,
    [bookingId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Booking not found.');
  }

  const booking = rows[0];
  if (req.user.role !== 'ADMIN' && booking.operator_user_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to confirm this booking.');
  }

  if (['CANCELLED_BY_USER', 'CANCELLED_BY_OPERATOR', 'EXPIRED'].includes(booking.booking_status)) {
    throw new ApiError(400, `Cannot confirm a booking in ${booking.booking_status} state.`);
  }

  const newAmountPaid = Math.min(
    Number(booking.total_amount),
    Number(booking.amount_paid) + Number(amount_received)
  );
  const newBalanceDue = Math.max(0, Number((booking.total_amount - newAmountPaid).toFixed(2)));

  await pool.query(
    `UPDATE bookings
     SET amount_paid = ?,
         balance_due = ?,
         booking_status = 'CONFIRMED',
         hold_expires_at = NULL,
         operator_remarks = COALESCE(?, operator_remarks)
     WHERE id = ?`,
    [newAmountPaid, newBalanceDue, operator_remarks || null, bookingId]
  );

  const [updated] = await pool.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [bookingId]);

  return res.status(200).json(
    new ApiResponse(200, 'Booking confirmed and payment ledger updated', updated[0])
  );
});

export const getOperatorEnquiries = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const [opRows] = await pool.query('SELECT id FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!opRows.length && req.user.role !== 'ADMIN') {
    throw new ApiError(404, 'Operator profile not found.');
  }

  const conditions = [];
  const params = [];

  if (req.user.role !== 'ADMIN') {
    conditions.push('e.operator_id = ?');
    params.push(opRows[0].id);
  }
  if (status) {
    conditions.push('e.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [enquiries] = await pool.query(
    `SELECT
       e.*,
       u.full_name AS traveler_name, u.email AS traveler_email,
       t.title AS trip_title, t.base_price AS standard_base_price
     FROM custom_trip_enquiries e
     JOIN users u ON u.id = e.user_id
     JOIN trips t ON t.id = e.trip_id
     ${whereClause}
     ORDER BY e.created_at DESC`,
    params
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator custom trip enquiries fetched', {
      count: enquiries.length,
      enquiries
    })
  );
});

export const respondToCustomEnquiry = asyncHandler(async (req, res) => {
  const enquiryId = Number(req.params.id);
  const { status, operator_quote_total, operator_response_notes } = quoteCustomEnquirySchema.parse(
    req.body
  );

  const [rows] = await pool.query(
    `SELECT e.*, o.user_id AS operator_user_id
     FROM custom_trip_enquiries e
     JOIN operators o ON o.id = e.operator_id
     WHERE e.id = ?
     LIMIT 1`,
    [enquiryId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Custom enquiry not found.');
  }

  if (req.user.role !== 'ADMIN' && rows[0].operator_user_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to respond to this enquiry.');
  }

  await pool.query(
    `UPDATE custom_trip_enquiries
     SET status = ?,
         operator_quote_total = COALESCE(?, operator_quote_total),
         operator_response_notes = COALESCE(?, operator_response_notes),
         responded_at = NOW()
     WHERE id = ?`,
    [status, operator_quote_total ?? null, operator_response_notes ?? null, enquiryId]
  );

  const [updated] = await pool.query(
    'SELECT * FROM custom_trip_enquiries WHERE id = ? LIMIT 1',
    [enquiryId]
  );

  return res.status(200).json(
    new ApiResponse(200, `Enquiry updated to ${status}`, updated[0])
  );
});

export const previewBookingCancellation = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  const [rows] = await pool.query(
    `SELECT
       b.*,
       t.title AS trip_title, t.cancellation_policy,
       td.batch_code, td.start_date
     FROM bookings b
     JOIN trips t ON t.id = b.trip_id
     JOIN trip_departures td ON td.id = b.departure_id
     WHERE b.booking_reference = ?
     LIMIT 1`,
    [reference]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Booking not found.');
  }

  const booking = rows[0];
  if (req.user.role !== 'ADMIN' && booking.user_id !== req.user.id) {
    throw new ApiError(403, 'You can only preview cancellation for your own booking.');
  }

  const refundBreakdown = calculateCancellationRefund({
    amountPaid: booking.amount_paid,
    startDate: booking.start_date,
    cancellationPolicy: booking.cancellation_policy,
    isOperatorCancelled: false
  });

  return res.status(200).json(
    new ApiResponse(200, 'Policy-driven cancellation & refund preview calculated', {
      booking_reference: booking.booking_reference,
      trip_title: booking.trip_title,
      departure_start_date: booking.start_date,
      booking_status: booking.booking_status,
      cancellation_policy_rules: booking.cancellation_policy,
      refund_calculation: refundBreakdown
    })
  );
});

export const cancelBookingByTraveler = asyncHandler(async (req, res) => {
  const { reference } = req.params;
  const { reason } = cancelBookingSchema.parse(req.body);

  const connection = await pool.getConnection();
  let updatedBooking;
  let refundRecord = null;

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT
         b.*,
         t.cancellation_policy,
         td.start_date, td.total_seats, td.booked_seats, td.offline_blocked_seats,
         td.min_group_size, td.departure_status
       FROM bookings b
       JOIN trips t ON t.id = b.trip_id
       JOIN trip_departures td ON td.id = b.departure_id
       WHERE b.booking_reference = ?
       FOR UPDATE`,
      [reference]
    );

    if (!rows.length) {
      throw new ApiError(404, 'Booking not found.');
    }

    const booking = rows[0];
    if (req.user.role !== 'ADMIN' && booking.user_id !== req.user.id) {
      throw new ApiError(403, 'You can only cancel your own booking.');
    }

    if (
      ['CANCELLED_BY_USER', 'CANCELLED_BY_OPERATOR', 'EXPIRED', 'COMPLETED'].includes(
        booking.booking_status
      )
    ) {
      throw new ApiError(400, `Cannot cancel a booking in ${booking.booking_status} state.`);
    }

    const refundCalc = calculateCancellationRefund({
      amountPaid: booking.amount_paid,
      startDate: booking.start_date,
      cancellationPolicy: booking.cancellation_policy,
      isOperatorCancelled: false
    });

    await connection.query(
      `UPDATE bookings
       SET booking_status = 'CANCELLED_BY_USER',
           cancelled_at = NOW(),
           cancellation_reason = ?,
           refund_amount_eligible = ?,
           balance_due = 0.00
       WHERE id = ?`,
      [reason, refundCalc.refund_amount, booking.id]
    );

    // Release reserved seats back to trip_departures & recalculate status
    const newBookedSeats = Math.max(0, Number(booking.booked_seats) - Number(booking.seats_count));
    const newDepStatus = computeDepartureStatus({
      total_seats: booking.total_seats,
      booked_seats: newBookedSeats,
      offline_blocked_seats: booking.offline_blocked_seats,
      min_group_size: booking.min_group_size,
      current_status: booking.departure_status
    });

    await connection.query(
      `UPDATE trip_departures
       SET booked_seats = ?,
           departure_status = ?,
           inventory_last_confirmed_at = NOW()
       WHERE id = ?`,
      [newBookedSeats, newDepStatus, booking.departure_id]
    );

    // Create Refund Record if traveler had paid any amount
    if (Number(booking.amount_paid) > 0) {
      const [paymentRows] = await connection.query(
        `SELECT id FROM payments WHERE booking_id = ? AND status = 'CAPTURED' ORDER BY id DESC LIMIT 1`,
        [booking.id]
      );
      const latestPaymentId = paymentRows.length ? paymentRows[0].id : null;
      const refundRef = generateReference('REF');
      const refundStatus =
        refundCalc.refund_amount > 0 ? 'PROCESSED' : 'NO_REFUND_ELIGIBLE';
      const gatewayRefundId =
        refundCalc.refund_amount > 0 ? `rfnd_Rzp_${Date.now()}` : null;

      const [insRefund] = await connection.query(
        `INSERT INTO refunds (
           refund_reference, booking_id, payment_id, user_id, operator_id,
           initiated_by, days_before_departure, policy_tier_applied,
           amount_paid_snapshot, refund_percentage, refund_amount,
           gateway_refund_id, status, reason, processed_at
         ) VALUES (?, ?, ?, ?, ?, 'TRAVELER', ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          refundRef,
          booking.id,
          latestPaymentId,
          booking.user_id,
          booking.operator_id,
          refundCalc.days_before_departure,
          refundCalc.policy_tier_applied,
          refundCalc.amount_paid_snapshot,
          refundCalc.refund_percentage,
          refundCalc.refund_amount,
          gatewayRefundId,
          refundStatus,
          reason
        ]
      );

      const [refRows] = await connection.query('SELECT * FROM refunds WHERE id = ? LIMIT 1', [
        insRefund.insertId
      ]);
      refundRecord = refRows[0];

      // Update operator escrow payout record
      if (refundCalc.refund_percentage === 100) {
        await connection.query(
          `UPDATE operator_payouts
           SET payout_status = 'CANCELLED_FORFEITED',
               net_operator_payable = 0.00,
               remarks = '100% refunded under free cancellation window'
           WHERE booking_id = ?`,
          [booking.id]
        );
      } else {
        const retainedAmount = refundCalc.non_refundable_retained;
        const retainedCommission = Number(
          ((retainedAmount * Number(booking.commission_rate_pct)) / 100).toFixed(2)
        );
        const retainedOperatorPayable = Number((retainedAmount - retainedCommission).toFixed(2));
        await connection.query(
          `UPDATE operator_payouts
           SET amount_collected = ?,
               platform_commission_amount = ?,
               net_operator_payable = ?,
               remarks = 'Adjusted for partial cancellation retention policy'
           WHERE booking_id = ?`,
          [retainedAmount, retainedCommission, retainedOperatorPayable, booking.id]
        );
      }
    }

    await connection.commit();

    const [updatedRows] = await pool.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [
      booking.id
    ]);
    updatedBooking = updatedRows[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return res.status(200).json(
    new ApiResponse(200, 'Booking cancelled and policy-driven refund processed', {
      booking: updatedBooking,
      refund: refundRecord
    })
  );
});

