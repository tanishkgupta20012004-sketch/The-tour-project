import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { computeDepartureStatus, formatDepartureConfidence } from './departure.utils.js';
import {
  cancelDepartureBatchSchema,
  createDepartureSchema,
  registerInterestSchema,
  syncInventorySchema
} from './departure.validation.js';

export const createDeparture = asyncHandler(async (req, res) => {
  const tripId = Number(req.params.tripId);
  const payload = createDepartureSchema.parse(req.body);

  const [tripRows] = await pool.query(
    `SELECT t.id, t.slug, o.user_id AS owner_user_id
     FROM trips t
     JOIN operators o ON o.id = t.operator_id
     WHERE t.id = ?
     LIMIT 1`,
    [tripId]
  );

  if (!tripRows.length) {
    throw new ApiError(404, 'Trip not found.');
  }

  const trip = tripRows[0];
  if (req.user.role !== 'ADMIN' && trip.owner_user_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to add departures to this trip.');
  }

  if (payload.offline_blocked_seats > payload.total_seats) {
    throw new ApiError(400, 'offline_blocked_seats cannot exceed total_seats.');
  }

  const batchCode =
    payload.batch_code ||
    `${trip.slug.slice(0, 6).toUpperCase()}-${payload.start_date.replace(/-/g, '')}-${Math.floor(
      10 + Math.random() * 90
    )}`;

  const initialStatus = computeDepartureStatus({
    total_seats: payload.total_seats,
    booked_seats: 0,
    offline_blocked_seats: payload.offline_blocked_seats,
    min_group_size: payload.min_group_size,
    current_status: 'OPEN'
  });

  const [result] = await pool.query(
    `INSERT INTO trip_departures (
       trip_id, batch_code, start_date, end_date,
       price_per_person, token_amount, total_seats,
       booked_seats, offline_blocked_seats, min_group_size,
       booking_deadline, departure_status, inventory_last_confirmed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW())`,
    [
      tripId,
      batchCode,
      payload.start_date,
      payload.end_date,
      payload.price_per_person,
      payload.token_amount,
      payload.total_seats,
      payload.offline_blocked_seats,
      payload.min_group_size,
      payload.booking_deadline,
      initialStatus
    ]
  );

  const [rows] = await pool.query('SELECT * FROM trip_departures WHERE id = ? LIMIT 1', [
    result.insertId
  ]);

  return res.status(201).json(
    new ApiResponse(
      201,
      'Departure batch created with Departure-Confidence tracking',
      formatDepartureConfidence(rows[0])
    )
  );
});

export const getDepartureById = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.id);

  const [rows] = await pool.query(
    `SELECT
       td.*,
       t.title AS trip_title, t.slug AS trip_slug, t.trip_category,
       t.origin_city, t.destination_city, t.duration_days, t.duration_nights,
       t.cancellation_policy,
       o.business_name AS operator_name, o.slug AS operator_slug, o.kyc_status AS operator_kyc_status,
       (SELECT COALESCE(SUM(dw.seats_interested), 0) FROM departure_waitlist dw WHERE dw.departure_id = td.id) AS interested_seats_count
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     JOIN operators o ON o.id = t.operator_id
     WHERE td.id = ?
     LIMIT 1`,
    [departureId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Departure batch not found.');
  }

  return res.status(200).json(
    new ApiResponse(200, 'Departure details and confidence metrics fetched', {
      ...formatDepartureConfidence(rows[0]),
      interested_seats_count: Number(rows[0].interested_seats_count || 0)
    })
  );
});

export const syncDepartureInventory = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.id);
  const payload = syncInventorySchema.parse(req.body);

  const [rows] = await pool.query(
    `SELECT td.*, o.user_id AS owner_user_id
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     JOIN operators o ON o.id = t.operator_id
     WHERE td.id = ?
     LIMIT 1`,
    [departureId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Departure batch not found.');
  }

  const current = rows[0];
  if (req.user.role !== 'ADMIN' && current.owner_user_id !== req.user.id) {
    throw new ApiError(403, 'You do not have permission to update this departure inventory.');
  }

  const newTotalSeats = payload.total_seats ?? current.total_seats;
  const newOfflineBlocked = payload.offline_blocked_seats ?? current.offline_blocked_seats;
  const newMinGroupSize = payload.min_group_size ?? current.min_group_size;

  if (current.booked_seats + newOfflineBlocked > newTotalSeats) {
    throw new ApiError(
      400,
      `Cannot set offline_blocked_seats to ${newOfflineBlocked}: platform booked_seats (${current.booked_seats}) + offline_blocked_seats (${newOfflineBlocked}) exceeds total_seats (${newTotalSeats}).`
    );
  }

  const newStatus = computeDepartureStatus({
    total_seats: newTotalSeats,
    booked_seats: current.booked_seats,
    offline_blocked_seats: newOfflineBlocked,
    min_group_size: newMinGroupSize,
    current_status: current.departure_status
  });

  await pool.query(
    `UPDATE trip_departures SET
       total_seats = ?,
       offline_blocked_seats = ?,
       min_group_size = ?,
       price_per_person = COALESCE(?, price_per_person),
       token_amount = COALESCE(?, token_amount),
       booking_deadline = COALESCE(?, booking_deadline),
       departure_status = ?,
       inventory_last_confirmed_at = NOW()
     WHERE id = ?`,
    [
      newTotalSeats,
      newOfflineBlocked,
      newMinGroupSize,
      payload.price_per_person ?? null,
      payload.token_amount ?? null,
      payload.booking_deadline ?? null,
      newStatus,
      departureId
    ]
  );

  // If the batch has now reached minimum group size, mark waitlisted travelers as notified
  let notifiedWaitlistCount = 0;
  if (
    current.booked_seats + newOfflineBlocked >= newMinGroupSize &&
    current.booked_seats + current.offline_blocked_seats < current.min_group_size
  ) {
    const [notifyRes] = await pool.query(
      `UPDATE departure_waitlist
       SET is_notified = TRUE
       WHERE departure_id = ? AND interest_type = 'WAIT_FOR_GUARANTEE' AND is_notified = FALSE`,
      [departureId]
    );
    notifiedWaitlistCount = notifyRes.affectedRows;
  }

  const [updatedRows] = await pool.query(
    'SELECT * FROM trip_departures WHERE id = ? LIMIT 1',
    [departureId]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Departure seat inventory & freshness timestamp synced', {
      ...formatDepartureConfidence(updatedRows[0]),
      waitlist_travelers_notified_on_guarantee: notifiedWaitlistCount
    })
  );
});

export const registerDepartureInterest = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.id);
  const { seats_interested, interest_type, notes } = registerInterestSchema.parse(req.body);

  const [depRows] = await pool.query(
    'SELECT id, trip_id, batch_code, departure_status FROM trip_departures WHERE id = ? LIMIT 1',
    [departureId]
  );

  if (!depRows.length) {
    throw new ApiError(404, 'Departure batch not found.');
  }

  const departure = depRows[0];

  await pool.query(
    `INSERT INTO departure_waitlist (departure_id, trip_id, user_id, seats_interested, interest_type, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       seats_interested = VALUES(seats_interested),
       interest_type = VALUES(interest_type),
       notes = VALUES(notes),
       is_notified = FALSE`,
    [departure.id, departure.trip_id, req.user.id, seats_interested, interest_type, notes || null]
  );

  const [interestRows] = await pool.query(
    'SELECT * FROM departure_waitlist WHERE departure_id = ? AND user_id = ? LIMIT 1',
    [departure.id, req.user.id]
  );

  return res.status(201).json(
    new ApiResponse(
      201,
      'Your interest in this departure batch has been registered. We will notify you on updates!',
      interestRows[0]
    )
  );
});

export const getDepartureInterestList = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.id);

  const [depRows] = await pool.query(
    `SELECT td.id, td.batch_code, o.user_id AS owner_user_id
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     JOIN operators o ON o.id = t.operator_id
     WHERE td.id = ?
     LIMIT 1`,
    [departureId]
  );

  if (!depRows.length) {
    throw new ApiError(404, 'Departure batch not found.');
  }

  if (req.user.role !== 'ADMIN' && depRows[0].owner_user_id !== req.user.id) {
    throw new ApiError(403, 'Only the trip operator or admin can view the departure waitlist.');
  }

  const [waitlist] = await pool.query(
    `SELECT
       dw.id, dw.seats_interested, dw.interest_type, dw.notes, dw.is_notified, dw.created_at,
       u.full_name AS traveler_name, u.phone AS traveler_phone,
       tp.home_city, tp.pace_preference, tp.social_style
     FROM departure_waitlist dw
     JOIN users u ON u.id = dw.user_id
     LEFT JOIN traveler_preferences tp ON tp.user_id = u.id
     WHERE dw.departure_id = ?
     ORDER BY dw.created_at DESC`,
    [departureId]
  );

  const totalSeatsInterested = waitlist.reduce((sum, item) => sum + Number(item.seats_interested), 0);

  return res.status(200).json(
    new ApiResponse(200, 'Departure waitlist & interested travelers fetched', {
      departure_id: departureId,
      batch_code: depRows[0].batch_code,
      interested_travelers_count: waitlist.length,
      total_seats_interested: totalSeatsInterested,
      waitlist
    })
  );
});

export const getDepartureManifest = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.id);
  const { format = 'json' } = req.query;

  const [depRows] = await pool.query(
    `SELECT
       td.*,
       t.title AS trip_title, t.trip_category,
       o.user_id AS owner_user_id, o.business_name AS operator_name
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     JOIN operators o ON o.id = t.operator_id
     WHERE td.id = ?
     LIMIT 1`,
    [departureId]
  );

  if (!depRows.length) {
    throw new ApiError(404, 'Departure batch not found.');
  }

  const dep = depRows[0];
  if (req.user.role !== 'ADMIN' && dep.owner_user_id !== req.user.id) {
    throw new ApiError(403, 'Only the trip operator or admin can view the participant manifest.');
  }

  const [participants] = await pool.query(
    `SELECT
       bp.*,
       b.booking_reference, b.booking_status, b.payment_plan,
       b.total_amount, b.amount_paid, b.balance_due
     FROM booking_participants bp
     JOIN bookings b ON b.id = bp.booking_id
     WHERE b.departure_id = ?
       AND b.booking_status IN ('CONFIRMED', 'PENDING_PAYMENT', 'COMPLETED')
     ORDER BY b.booking_status ASC, bp.id ASC`,
    [departureId]
  );

  if (String(format).toLowerCase() === 'csv') {
    const headers = [
      'BookingRef',
      'BookingStatus',
      'FullName',
      'Age',
      'Gender',
      'Phone',
      'IDProofType',
      'DrivingLicense',
      'BloodGroup',
      'EmergencyContactName',
      'EmergencyContactPhone',
      'BalanceDueINR'
    ];
    const csvRows = [headers.join(',')];
    for (const p of participants) {
      csvRows.push(
        [
          p.booking_reference,
          p.booking_status,
          `"${String(p.full_name).replace(/"/g, '""')}"`,
          p.age,
          p.gender,
          p.phone,
          p.id_proof_type,
          p.driving_license_number || '',
          p.blood_group || '',
          `"${String(p.emergency_contact_name).replace(/"/g, '""')}"`,
          p.emergency_contact_phone,
          p.balance_due
        ].join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="manifest-${dep.batch_code}.csv"`
    );
    return res.status(200).send(csvRows.join('\n'));
  }

  return res.status(200).json(
    new ApiResponse(200, 'Departure participant manifest fetched', {
      departure: formatDepartureConfidence(dep),
      total_participants_count: participants.length,
      participants
    })
  );
});

export const cancelDepartureBatch = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.id);
  const { reason } = cancelDepartureBatchSchema.parse(req.body);

  const connection = await pool.getConnection();
  let cancelledBookingsCount = 0;
  let refundsCreatedCount = 0;
  let totalRefundAmount = 0;

  try {
    await connection.beginTransaction();

    const [depRows] = await connection.query(
      `SELECT
         td.*,
         t.operator_id,
         o.user_id AS owner_user_id
       FROM trip_departures td
       JOIN trips t ON t.id = td.trip_id
       JOIN operators o ON o.id = t.operator_id
       WHERE td.id = ?
       FOR UPDATE`,
      [departureId]
    );

    if (!depRows.length) {
      throw new ApiError(404, 'Departure batch not found.');
    }

    const dep = depRows[0];
    if (req.user.role !== 'ADMIN' && dep.owner_user_id !== req.user.id) {
      throw new ApiError(403, 'You do not have permission to cancel this departure batch.');
    }

    if (dep.departure_status === 'CANCELLED') {
      throw new ApiError(400, 'This departure batch is already cancelled.');
    }

    // 1. Mark Departure Batch as CANCELLED
    await connection.query(
      `UPDATE trip_departures
       SET departure_status = 'CANCELLED',
           inventory_last_confirmed_at = NOW()
       WHERE id = ?`,
      [departureId]
    );

    // 2. Fetch all active bookings on this batch & issue 100% refunds
    const [activeBookings] = await connection.query(
      `SELECT *
       FROM bookings
       WHERE departure_id = ?
         AND booking_status IN ('CONFIRMED', 'PENDING_PAYMENT')
       FOR UPDATE`,
      [departureId]
    );

    const daysBeforeDeparture = Math.max(
      0,
      Math.ceil((new Date(dep.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );

    for (const booking of activeBookings) {
      cancelledBookingsCount++;
      const paid = Number(booking.amount_paid || 0);

      await connection.query(
        `UPDATE bookings
         SET booking_status = 'CANCELLED_BY_OPERATOR',
             cancelled_at = NOW(),
             cancellation_reason = ?,
             refund_amount_eligible = ?,
             balance_due = 0.00
         WHERE id = ?`,
        [`Operator Batch Cancellation: ${reason}`, paid, booking.id]
      );

      if (paid > 0) {
        refundsCreatedCount++;
        totalRefundAmount += paid;

        const refundRef = `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
          10000 + Math.random() * 90000
        )}`;

        await connection.query(
          `INSERT INTO refunds (
             refund_reference, booking_id, user_id, operator_id,
             initiated_by, days_before_departure, policy_tier_applied,
             amount_paid_snapshot, refund_percentage, refund_amount,
             gateway_refund_id, status, reason, processed_at
           ) VALUES (
             ?, ?, ?, ?,
             'OPERATOR', ?, 'OPERATOR_BATCH_CANCELLATION (100%)',
             ?, 100.00, ?,
             ?, 'PROCESSED', ?, NOW()
           )`,
          [
            refundRef,
            booking.id,
            booking.user_id,
            dep.operator_id,
            daysBeforeDeparture,
            paid,
            paid,
            `rfnd_Rzp_${Date.now()}_${booking.id}`,
            reason
          ]
        );

        await connection.query(
          `UPDATE operator_payouts
           SET payout_status = 'CANCELLED_FORFEITED',
               net_operator_payable = 0.00,
               remarks = ?
           WHERE booking_id = ?`,
          [`Batch cancelled by operator: ${reason}`, booking.id]
        );
      }
    }

    // 3. Update Operator Cancellation Rate Metric
    const [[opDepStats]] = await connection.query(
      `SELECT
         COUNT(*) AS total_batches,
         SUM(CASE WHEN td.departure_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_batches
       FROM trip_departures td
       JOIN trips t ON t.id = td.trip_id
       WHERE t.operator_id = ?`,
      [dep.operator_id]
    );

    const newCancelRate =
      Number(opDepStats.total_batches) > 0
        ? Number(
            (
              (Number(opDepStats.cancelled_batches) / Number(opDepStats.total_batches)) *
              100
            ).toFixed(2)
          )
        : 0;

    await connection.query(`UPDATE operators SET cancellation_rate_pct = ? WHERE id = ?`, [
      newCancelRate,
      dep.operator_id
    ]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      'Departure batch cancelled. 100% refunds initiated for all paid bookings.',
      {
        departure_id: departureId,
        departure_status: 'CANCELLED',
        cancelled_bookings_count: cancelledBookingsCount,
        full_refunds_initiated_count: refundsCreatedCount,
        total_refund_amount_inr: Number(totalRefundAmount.toFixed(2))
      }
    )
  );
});


