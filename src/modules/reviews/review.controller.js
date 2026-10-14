import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { computeOperatorTrustScore } from './review.utils.js';
import {
  createIncidentSchema,
  createVerifiedReviewSchema,
  operatorIncidentExplanationSchema,
  replyToReviewSchema,
  resolveIncidentSchema
} from './review.validation.js';

export const createVerifiedReview = asyncHandler(async (req, res) => {
  const payload = createVerifiedReviewSchema.parse(req.body);

  const [bookingRows] = await pool.query(
    `SELECT * FROM bookings WHERE booking_reference = ? LIMIT 1`,
    [payload.booking_reference]
  );

  if (!bookingRows.length) {
    throw new ApiError(404, 'Booking not found.');
  }

  const booking = bookingRows[0];

  // Strictly enforce verified booking ownership & status (Problem 2: Verified reviews only)
  if (booking.user_id !== req.user.id) {
    throw new ApiError(403, 'Only the traveler who booked this trip can submit a verified review.');
  }

  if (!['CONFIRMED', 'COMPLETED'].includes(booking.booking_status)) {
    throw new ApiError(
      400,
      `Only CONFIRMED or COMPLETED bookings are eligible for verified reviews (current status: ${booking.booking_status}).`
    );
  }

  const [existingReview] = await pool.query(
    'SELECT id FROM reviews WHERE booking_id = ? LIMIT 1',
    [booking.id]
  );

  if (existingReview.length) {
    throw new ApiError(409, 'A verified review has already been submitted for this booking.');
  }

  const connection = await pool.getConnection();
  let reviewId;
  let updatedOperatorStats;

  try {
    await connection.beginTransaction();

    const [insRes] = await connection.query(
      `INSERT INTO reviews (
         booking_id, user_id, trip_id, departure_id, operator_id,
         overall_rating, itinerary_accuracy_rating, safety_and_captain_rating,
         accommodation_and_food_rating, group_vibe_rating,
         review_title, review_text, is_verified_booking
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        booking.id,
        req.user.id,
        booking.trip_id,
        booking.departure_id,
        booking.operator_id,
        payload.overall_rating,
        payload.itinerary_accuracy_rating,
        payload.safety_and_captain_rating,
        payload.accommodation_and_food_rating,
        payload.group_vibe_rating,
        payload.review_title,
        payload.review_text
      ]
    );
    reviewId = insRes.insertId;

    // Recalculate Operator's Aggregate Rating & Reviews Count
    const [[agg]] = await connection.query(
      `SELECT
         COUNT(*) AS total_reviews,
         ROUND(AVG(overall_rating), 2) AS avg_overall
       FROM reviews
       WHERE operator_id = ?`,
      [booking.operator_id]
    );

    await connection.query(
      `UPDATE operators
       SET rating_avg = ?,
           reviews_count = ?
       WHERE id = ?`,
      [Number(agg.avg_overall || payload.overall_rating), Number(agg.total_reviews), booking.operator_id]
    );

    const [opRows] = await connection.query(
      'SELECT id, business_name, rating_avg, reviews_count FROM operators WHERE id = ? LIMIT 1',
      [booking.operator_id]
    );
    updatedOperatorStats = opRows[0];

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [reviewRows] = await pool.query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [reviewId]);

  return res.status(201).json(
    new ApiResponse(201, 'Verified booking review published successfully', {
      review: reviewRows[0],
      operator_rating_updated: updatedOperatorStats
    })
  );
});

export const getTripReviews = asyncHandler(async (req, res) => {
  const tripId = Number(req.params.tripId);

  const [[summary]] = await pool.query(
    `SELECT
       COUNT(*) AS total_verified_reviews,
       ROUND(AVG(overall_rating), 2) AS avg_overall_rating,
       ROUND(AVG(itinerary_accuracy_rating), 2) AS avg_itinerary_accuracy,
       ROUND(AVG(safety_and_captain_rating), 2) AS avg_safety_and_captain,
       ROUND(AVG(accommodation_and_food_rating), 2) AS avg_accommodation_and_food,
       ROUND(AVG(group_vibe_rating), 2) AS avg_group_vibe
     FROM reviews
     WHERE trip_id = ?`,
    [tripId]
  );

  const [reviews] = await pool.query(
    `SELECT
       r.*,
       u.full_name AS reviewer_name,
       td.batch_code, td.start_date AS trip_departure_date
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN trip_departures td ON td.id = r.departure_id
     WHERE r.trip_id = ?
     ORDER BY r.created_at DESC`,
    [tripId]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Verified trip reviews & multi-dimensional ratings fetched', {
      trip_id: tripId,
      rating_summary: {
        total_verified_reviews: Number(summary.total_verified_reviews || 0),
        avg_overall_rating: Number(summary.avg_overall_rating || 0),
        avg_itinerary_accuracy: Number(summary.avg_itinerary_accuracy || 0),
        avg_safety_and_captain: Number(summary.avg_safety_and_captain || 0),
        avg_accommodation_and_food: Number(summary.avg_accommodation_and_food || 0),
        avg_group_vibe: Number(summary.avg_group_vibe || 0)
      },
      reviews
    })
  );
});

export const getOperatorReviewsAndTrust = asyncHandler(async (req, res) => {
  const { operatorSlug } = req.params;

  const [opRows] = await pool.query('SELECT * FROM operators WHERE slug = ? LIMIT 1', [
    operatorSlug
  ]);

  if (!opRows.length) {
    throw new ApiError(404, 'Operator not found.');
  }

  const operator = opRows[0];

  const [[incidentCountRow]] = await pool.query(
    `SELECT COUNT(*) AS open_high_incidents
     FROM trip_incidents
     WHERE operator_id = ?
       AND severity IN ('HIGH', 'CRITICAL_SOS')
       AND status IN ('OPEN', 'INVESTIGATING')`,
    [operator.id]
  );

  const trustReport = computeOperatorTrustScore({
    kyc_status: operator.kyc_status,
    rating_avg: operator.rating_avg,
    reviews_count: operator.reviews_count,
    total_completed_trips: operator.total_completed_trips,
    cancellation_rate_pct: operator.cancellation_rate_pct,
    open_high_severity_incidents: incidentCountRow.open_high_incidents
  });

  const [[dimensionAvg]] = await pool.query(
    `SELECT
       COUNT(*) AS verified_reviews_in_db,
       ROUND(AVG(overall_rating), 2) AS avg_overall,
       ROUND(AVG(itinerary_accuracy_rating), 2) AS avg_itinerary_accuracy,
       ROUND(AVG(safety_and_captain_rating), 2) AS avg_safety_and_captain,
       ROUND(AVG(accommodation_and_food_rating), 2) AS avg_accommodation_and_food,
       ROUND(AVG(group_vibe_rating), 2) AS avg_group_vibe
     FROM reviews
     WHERE operator_id = ?`,
    [operator.id]
  );

  const [reviews] = await pool.query(
    `SELECT
       r.*,
       u.full_name AS reviewer_name,
       t.title AS trip_title, t.slug AS trip_slug,
       td.batch_code, td.start_date
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     JOIN trips t ON t.id = r.trip_id
     JOIN trip_departures td ON td.id = r.departure_id
     WHERE r.operator_id = ?
     ORDER BY r.created_at DESC`,
    [operator.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator composite trust score & verified reviews fetched', {
      operator: {
        id: operator.id,
        business_name: operator.business_name,
        slug: operator.slug,
        kyc_status: operator.kyc_status,
        verified_at: operator.verified_at,
        rating_avg: operator.rating_avg,
        reviews_count: operator.reviews_count,
        total_completed_trips: operator.total_completed_trips,
        cancellation_rate_pct: operator.cancellation_rate_pct
      },
      trust_profile: trustReport,
      multi_dimensional_averages: dimensionAvg,
      reviews
    })
  );
});

export const replyToReview = asyncHandler(async (req, res) => {
  const reviewId = Number(req.params.id);
  const { operator_public_reply } = replyToReviewSchema.parse(req.body);

  const [rows] = await pool.query(
    `SELECT r.*, o.user_id AS operator_user_id
     FROM reviews r
     JOIN operators o ON o.id = r.operator_id
     WHERE r.id = ?
     LIMIT 1`,
    [reviewId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Review not found.');
  }

  if (req.user.role !== 'ADMIN' && rows[0].operator_user_id !== req.user.id) {
    throw new ApiError(403, 'Only the operator of this trip can reply to this review.');
  }

  await pool.query(
    `UPDATE reviews
     SET operator_public_reply = ?,
         operator_replied_at = NOW()
     WHERE id = ?`,
    [operator_public_reply, reviewId]
  );

  const [updated] = await pool.query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [reviewId]);

  return res.status(200).json(
    new ApiResponse(200, 'Operator public response posted to review', updated[0])
  );
});

// ============================================================================
// ACTIVE TRIP SAFETY, SOS & QUALITY INCIDENT SYSTEM (Problem 2)
// ============================================================================

export const reportTripIncident = asyncHandler(async (req, res) => {
  const payload = createIncidentSchema.parse(req.body);

  const [bookingRows] = await pool.query(
    `SELECT
       b.*,
       o.business_name AS operator_name,
       o.support_phone AS operator_support_phone,
       o.emergency_contact_phone AS operator_emergency_phone
     FROM bookings b
     JOIN operators o ON o.id = b.operator_id
     WHERE b.booking_reference = ?
     LIMIT 1`,
    [payload.booking_reference]
  );

  if (!bookingRows.length) {
    throw new ApiError(404, 'Booking not found.');
  }

  const booking = bookingRows[0];
  if (req.user.role !== 'ADMIN' && booking.user_id !== req.user.id) {
    throw new ApiError(403, 'You can only report an incident for your own booking.');
  }

  const shouldFreezePayout = ['HIGH', 'CRITICAL_SOS'].includes(payload.severity);
  const incidentRef = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    10000 + Math.random() * 90000
  )}`;

  const connection = await pool.getConnection();
  let incidentId;

  try {
    await connection.beginTransaction();

    const [insRes] = await connection.query(
      `INSERT INTO trip_incidents (
         incident_reference, booking_id, departure_id, trip_id, operator_id,
         reported_by_user_id, incident_category, severity,
         description, evidence_urls, payout_frozen, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
      [
        incidentRef,
        booking.id,
        booking.departure_id,
        booking.trip_id,
        booking.operator_id,
        req.user.id,
        payload.incident_category,
        payload.severity,
        payload.description,
        JSON.stringify(payload.evidence_urls || []),
        shouldFreezePayout
      ]
    );
    incidentId = insRes.insertId;

    // Automatically freeze operator escrow payout on HIGH / CRITICAL_SOS incidents
    if (shouldFreezePayout) {
      await connection.query(
        `UPDATE operator_payouts
         SET remarks = ?
         WHERE booking_id = ? AND payout_status = 'ESCROW_HELD'`,
        [`ESCROW_FROZEN: Pending investigation of ${incidentRef} (${payload.severity})`, booking.id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [incidentRows] = await pool.query('SELECT * FROM trip_incidents WHERE id = ? LIMIT 1', [
    incidentId
  ]);

  return res.status(201).json(
    new ApiResponse(
      201,
      shouldFreezePayout
        ? 'High-priority incident logged. Operator escrow payout has been frozen pending resolution.'
        : 'Trip incident logged for review.',
      {
        incident: incidentRows[0],
        emergency_contacts: {
          operator_name: booking.operator_name,
          operator_emergency_phone: booking.operator_emergency_phone,
          operator_support_phone: booking.operator_support_phone,
          platform_24x7_safety_helpline: '1800-120-SAFE-TOUR'
        }
      }
    )
  );
});

export const getMyIncidents = asyncHandler(async (req, res) => {
  const [incidents] = await pool.query(
    `SELECT
       i.*,
       b.booking_reference,
       t.title AS trip_title,
       o.business_name AS operator_name
     FROM trip_incidents i
     JOIN bookings b ON b.id = i.booking_id
     JOIN trips t ON t.id = i.trip_id
     JOIN operators o ON o.id = i.operator_id
     WHERE i.reported_by_user_id = ?
     ORDER BY i.created_at DESC`,
    [req.user.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Traveler reported incidents fetched', {
      count: incidents.length,
      incidents
    })
  );
});

export const getOperatorIncidents = asyncHandler(async (req, res) => {
  const [opRows] = await pool.query('SELECT id FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!opRows.length && req.user.role !== 'ADMIN') {
    throw new ApiError(404, 'Operator profile not found.');
  }

  const filterClause = req.user.role === 'ADMIN' ? '' : 'WHERE i.operator_id = ?';
  const params = req.user.role === 'ADMIN' ? [] : [opRows[0].id];

  const [incidents] = await pool.query(
    `SELECT
       i.*,
       b.booking_reference,
       u.full_name AS traveler_name, u.phone AS traveler_phone,
       t.title AS trip_title,
       td.batch_code
     FROM trip_incidents i
     JOIN bookings b ON b.id = i.booking_id
     JOIN users u ON u.id = i.reported_by_user_id
     JOIN trips t ON t.id = i.trip_id
     JOIN trip_departures td ON td.id = i.departure_id
     ${filterClause}
     ORDER BY i.created_at DESC`,
    params
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator trip incidents fetched', {
      count: incidents.length,
      incidents
    })
  );
});

export const submitOperatorIncidentExplanation = asyncHandler(async (req, res) => {
  const incidentId = Number(req.params.id);
  const { operator_explanation } = operatorIncidentExplanationSchema.parse(req.body);

  const [rows] = await pool.query(
    `SELECT i.*, o.user_id AS operator_user_id
     FROM trip_incidents i
     JOIN operators o ON o.id = i.operator_id
     WHERE i.id = ?
     LIMIT 1`,
    [incidentId]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Incident not found.');
  }

  if (req.user.role !== 'ADMIN' && rows[0].operator_user_id !== req.user.id) {
    throw new ApiError(403, 'Only the trip operator can submit an explanation for this incident.');
  }

  await pool.query(
    `UPDATE trip_incidents
     SET operator_explanation = ?,
         status = CASE WHEN status = 'OPEN' THEN 'INVESTIGATING' ELSE status END
     WHERE id = ?`,
    [operator_explanation, incidentId]
  );

  const [updated] = await pool.query('SELECT * FROM trip_incidents WHERE id = ? LIMIT 1', [
    incidentId
  ]);

  return res.status(200).json(
    new ApiResponse(200, 'Operator explanation recorded on incident', updated[0])
  );
});

export const resolveIncidentByAdmin = asyncHandler(async (req, res) => {
  const incidentId = Number(req.params.id);
  const { status, admin_resolution_notes, unfreeze_operator_payout } =
    resolveIncidentSchema.parse(req.body);

  const [rows] = await pool.query('SELECT * FROM trip_incidents WHERE id = ? LIMIT 1', [
    incidentId
  ]);

  if (!rows.length) {
    throw new ApiError(404, 'Incident not found.');
  }

  const incident = rows[0];
  const payoutFrozenNow = unfreeze_operator_payout ? false : Boolean(incident.payout_frozen);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE trip_incidents
       SET status = ?,
           admin_resolution_notes = ?,
           payout_frozen = ?,
           resolved_by_admin_id = ?,
           resolved_at = CASE WHEN ? IN ('RESOLVED_TRAVELER_COMPENSATED', 'RESOLVED_NO_FAULT', 'DISMISSED') THEN NOW() ELSE resolved_at END
       WHERE id = ?`,
      [status, admin_resolution_notes, payoutFrozenNow, req.user.id, status, incidentId]
    );

    if (unfreeze_operator_payout) {
      await connection.query(
        `UPDATE operator_payouts
         SET remarks = ?
         WHERE booking_id = ?`,
        [`Incident ${incident.incident_reference} resolved (${status}): ${admin_resolution_notes}`, incident.booking_id]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [updated] = await pool.query('SELECT * FROM trip_incidents WHERE id = ? LIMIT 1', [
    incidentId
  ]);

  return res.status(200).json(
    new ApiResponse(200, `Incident updated to ${status}`, updated[0])
  );
});
