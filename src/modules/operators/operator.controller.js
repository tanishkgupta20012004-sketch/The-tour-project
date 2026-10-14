import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createSlug } from '../../utils/slugify.js';
import {
  onboardOperatorSchema,
  updateOperatorProfileSchema,
  verifyOperatorKycSchema
} from './operator.validation.js';

export const onboardOperator = asyncHandler(async (req, res) => {
  const payload = onboardOperatorSchema.parse(req.body);

  // Check if user already has an operator profile
  const [existing] = await pool.query(
    'SELECT id FROM operators WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );

  if (existing.length) {
    throw new ApiError(409, 'You have already submitted an operator onboarding profile.');
  }

  let slug = createSlug(payload.business_name);
  const [slugExists] = await pool.query('SELECT id FROM operators WHERE slug = ? LIMIT 1', [slug]);
  if (slugExists.length) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const connection = await pool.getConnection();
  let operatorId;
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.query(
      `INSERT INTO operators (
         user_id, business_name, slug, tagline, bio, operator_type,
         base_city, operating_regions, instagram_handle, website_url,
         support_email, support_phone, emergency_contact_phone,
         gst_number, pan_number, kyc_documents, kyc_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        req.user.id,
        payload.business_name,
        slug,
        payload.tagline || null,
        payload.bio || null,
        payload.operator_type,
        payload.base_city,
        JSON.stringify(payload.operating_regions),
        payload.instagram_handle || null,
        payload.website_url || null,
        payload.support_email || req.user.email || null,
        payload.support_phone,
        payload.emergency_contact_phone,
        payload.gst_number || null,
        payload.pan_number || null,
        payload.kyc_documents ? JSON.stringify(payload.kyc_documents) : null
      ]
    );
    operatorId = insertResult.insertId;

    // Upgrade user role to OPERATOR if currently TRAVELER
    if (req.user.role === 'TRAVELER') {
      await connection.query(`UPDATE users SET role = 'OPERATOR' WHERE id = ?`, [req.user.id]);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [rows] = await pool.query('SELECT * FROM operators WHERE id = ? LIMIT 1', [operatorId]);

  return res.status(201).json(
    new ApiResponse(
      201,
      'Operator onboarding profile submitted successfully. Pending KYC verification.',
      rows[0]
    )
  );
});

export const listPublicOperators = asyncHandler(async (req, res) => {
  const { base_city, operator_type, verified_only = 'true' } = req.query;

  const conditions = [];
  const params = [];

  if (verified_only === 'true') {
    conditions.push(`o.kyc_status = 'VERIFIED'`);
  }
  if (base_city) {
    conditions.push(`o.base_city = ?`);
    params.push(base_city);
  }
  if (operator_type) {
    conditions.push(`o.operator_type = ?`);
    params.push(operator_type);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [operators] = await pool.query(
    `SELECT
       o.id, o.business_name, o.slug, o.tagline, o.bio, o.operator_type,
       o.base_city, o.operating_regions, o.instagram_handle, o.website_url,
       o.kyc_status, o.verified_at, o.rating_avg, o.reviews_count,
       o.total_completed_trips, o.cancellation_rate_pct,
       (SELECT COUNT(*) FROM trips t WHERE t.operator_id = o.id AND t.status = 'PUBLISHED') AS active_trips_count
     FROM operators o
     ${whereClause}
     ORDER BY o.rating_avg DESC, o.total_completed_trips DESC`,
    params
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operators fetched successfully', {
      count: operators.length,
      operators
    })
  );
});

export const getOperatorBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const [rows] = await pool.query(
    `SELECT
       o.id, o.business_name, o.slug, o.tagline, o.bio, o.operator_type,
       o.base_city, o.operating_regions, o.instagram_handle, o.website_url,
       o.support_email, o.support_phone, o.emergency_contact_phone,
       o.kyc_status, o.verified_at, o.rating_avg, o.reviews_count,
       o.total_completed_trips, o.cancellation_rate_pct, o.created_at
     FROM operators o
     WHERE o.slug = ?
     LIMIT 1`,
    [slug]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Operator profile not found.');
  }

  const operator = rows[0];

  // Fetch published trips organized by this operator
  const [trips] = await pool.query(
    `SELECT
       t.id, t.title, t.slug, t.trip_category, t.experience_type,
       t.origin_city, t.destination_city, t.duration_days, t.duration_nights,
       t.base_price, t.comfort_level, t.difficulty_level, t.pace_tag, t.vibe_tags
     FROM trips t
     WHERE t.operator_id = ? AND t.status = 'PUBLISHED'
     ORDER BY t.created_at DESC`,
    [operator.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator profile details fetched', {
      operator,
      published_trips: trips
    })
  );
});

export const getMyOperatorProfile = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!rows.length) {
    throw new ApiError(404, 'No operator profile found for this user.');
  }

  return res.status(200).json(new ApiResponse(200, 'Operator profile fetched', rows[0]));
});

export const updateMyOperatorProfile = asyncHandler(async (req, res) => {
  const payload = updateOperatorProfileSchema.parse(req.body);

  const [rows] = await pool.query('SELECT * FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!rows.length) {
    throw new ApiError(404, 'No operator profile found for this user.');
  }

  const current = rows[0];

  await pool.query(
    `UPDATE operators SET
       business_name = COALESCE(?, business_name),
       tagline = COALESCE(?, tagline),
       bio = COALESCE(?, bio),
       operator_type = COALESCE(?, operator_type),
       base_city = COALESCE(?, base_city),
       operating_regions = COALESCE(?, operating_regions),
       instagram_handle = COALESCE(?, instagram_handle),
       website_url = COALESCE(?, website_url),
       support_email = COALESCE(?, support_email),
       support_phone = COALESCE(?, support_phone),
       emergency_contact_phone = COALESCE(?, emergency_contact_phone),
       gst_number = COALESCE(?, gst_number),
       pan_number = COALESCE(?, pan_number),
       kyc_documents = COALESCE(?, kyc_documents)
     WHERE id = ?`,
    [
      payload.business_name ?? null,
      payload.tagline ?? null,
      payload.bio ?? null,
      payload.operator_type ?? null,
      payload.base_city ?? null,
      payload.operating_regions ? JSON.stringify(payload.operating_regions) : null,
      payload.instagram_handle ?? null,
      payload.website_url ?? null,
      payload.support_email ?? null,
      payload.support_phone ?? null,
      payload.emergency_contact_phone ?? null,
      payload.gst_number ?? null,
      payload.pan_number ?? null,
      payload.kyc_documents ? JSON.stringify(payload.kyc_documents) : null,
      current.id
    ]
  );

  const [updated] = await pool.query('SELECT * FROM operators WHERE id = ? LIMIT 1', [current.id]);

  return res.status(200).json(
    new ApiResponse(200, 'Operator profile updated successfully', updated[0])
  );
});

export const verifyOperatorKyc = asyncHandler(async (req, res) => {
  const operatorId = Number(req.params.id);
  const { kyc_status, remarks, commission_rate_pct } = verifyOperatorKycSchema.parse(req.body);

  const [rows] = await pool.query('SELECT * FROM operators WHERE id = ? LIMIT 1', [operatorId]);
  if (!rows.length) {
    throw new ApiError(404, 'Operator not found.');
  }

  const operator = rows[0];
  const previousStatus = operator.kyc_status;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE operators
       SET kyc_status = ?,
           kyc_rejection_reason = ?,
           verified_at = CASE WHEN ? = 'VERIFIED' THEN NOW() ELSE verified_at END,
           verified_by_admin_id = ?,
           commission_rate_pct = COALESCE(?, commission_rate_pct)
       WHERE id = ?`,
      [
        kyc_status,
        kyc_status === 'REJECTED' ? remarks || 'KYC documents incomplete' : null,
        kyc_status,
        req.user.id,
        commission_rate_pct ?? null,
        operatorId
      ]
    );

    await connection.query(
      `INSERT INTO operator_verification_logs (operator_id, admin_id, previous_status, new_status, remarks)
       VALUES (?, ?, ?, ?, ?)`,
      [operatorId, req.user.id, previousStatus, kyc_status, remarks || null]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [updated] = await pool.query('SELECT * FROM operators WHERE id = ? LIMIT 1', [operatorId]);

  return res.status(200).json(
    new ApiResponse(200, `Operator KYC status updated to ${kyc_status}`, updated[0])
  );
});

export const getOperatorVerificationLogs = asyncHandler(async (req, res) => {
  const operatorId = Number(req.params.id);

  const [logs] = await pool.query(
    `SELECT
       l.id, l.operator_id, l.previous_status, l.new_status, l.remarks, l.created_at,
       u.full_name AS admin_name, u.email AS admin_email
     FROM operator_verification_logs l
     JOIN users u ON u.id = l.admin_id
     WHERE l.operator_id = ?
     ORDER BY l.created_at DESC`,
    [operatorId]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator verification audit trail fetched', logs)
  );
});

export const getOperatorDashboard = asyncHandler(async (req, res) => {
  const [opRows] = await pool.query('SELECT * FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!opRows.length) {
    throw new ApiError(404, 'No operator profile found for this user.');
  }

  const operator = opRows[0];

  // 1. Aggregate Trip & Seat Capacity Stats
  const [depStatsRows] = await pool.query(
    `SELECT
       COUNT(td.id) AS upcoming_departures_count,
       COALESCE(SUM(td.total_seats), 0) AS total_seat_capacity,
       COALESCE(SUM(td.booked_seats), 0) AS seats_booked_on_platform,
       COALESCE(SUM(td.offline_blocked_seats), 0) AS seats_filled_offline,
       SUM(CASE WHEN td.departure_status IN ('GUARANTEED', 'FILLING_FAST', 'SOLD_OUT') THEN 1 ELSE 0 END) AS guaranteed_departures_count
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     WHERE t.operator_id = ?
       AND td.departure_status NOT IN ('CANCELLED', 'COMPLETED')`,
    [operator.id]
  );

  // 2. Aggregate Booking & Revenue Unit Economics
  const [revStatsRows] = await pool.query(
    `SELECT
       COUNT(id) AS total_active_bookings,
       SUM(CASE WHEN booking_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_bookings_count,
       SUM(CASE WHEN booking_status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) AS pending_payment_bookings_count,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN total_amount ELSE 0 END), 0) AS confirmed_gmv,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN amount_paid ELSE 0 END), 0) AS total_amount_collected,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN balance_due ELSE 0 END), 0) AS pending_balance_due,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN operator_payout_amount ELSE 0 END), 0) AS net_operator_payout_earned
     FROM bookings
     WHERE operator_id = ?`,
    [operator.id]
  );

  // 3. Open Enquiries & Waitlist Leads Count
  const [[enquiryStat]] = await pool.query(
    `SELECT COUNT(*) AS open_enquiries_count
     FROM custom_trip_enquiries
     WHERE operator_id = ? AND status = 'OPEN'`,
    [operator.id]
  );

  const [[waitlistStat]] = await pool.query(
    `SELECT COALESCE(SUM(dw.seats_interested), 0) AS waitlisted_seats_count
     FROM departure_waitlist dw
     JOIN trips t ON t.id = dw.trip_id
     WHERE t.operator_id = ?`,
    [operator.id]
  );

  // 4. Upcoming Departures with Inventory Freshness & Reminders
  const [upcomingDepartures] = await pool.query(
    `SELECT
       td.id, td.batch_code, td.start_date, td.end_date,
       td.total_seats, td.booked_seats, td.offline_blocked_seats,
       td.min_group_size, td.departure_status, td.inventory_last_confirmed_at,
       t.title AS trip_title, t.trip_category,
       TIMESTAMPDIFF(HOUR, td.inventory_last_confirmed_at, NOW()) AS hours_since_inventory_sync
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     WHERE t.operator_id = ?
       AND td.departure_status NOT IN ('CANCELLED', 'COMPLETED')
     ORDER BY td.start_date ASC
     LIMIT 10`,
    [operator.id]
  );

  const depStats = depStatsRows[0];
  const revStats = revStatsRows[0];
  const totalOccupied =
    Number(depStats.seats_booked_on_platform) + Number(depStats.seats_filled_offline);
  const totalCapacity = Number(depStats.total_seat_capacity);

  return res.status(200).json(
    new ApiResponse(200, 'Operator B2B dashboard summary fetched', {
      operator: {
        id: operator.id,
        business_name: operator.business_name,
        kyc_status: operator.kyc_status,
        rating_avg: operator.rating_avg,
        commission_rate_pct: operator.commission_rate_pct
      },
      inventory_overview: {
        upcoming_departures_count: Number(depStats.upcoming_departures_count),
        guaranteed_departures_count: Number(depStats.guaranteed_departures_count || 0),
        total_seat_capacity: totalCapacity,
        seats_booked_on_platform: Number(depStats.seats_booked_on_platform),
        seats_filled_offline_instagram: Number(depStats.seats_filled_offline),
        available_seats_remaining: Math.max(0, totalCapacity - totalOccupied),
        overall_occupancy_percentage:
          totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0
      },
      financial_ledger: {
        total_active_bookings: Number(revStats.total_active_bookings),
        confirmed_bookings_count: Number(revStats.confirmed_bookings_count || 0),
        pending_payment_bookings_count: Number(revStats.pending_payment_bookings_count || 0),
        confirmed_gmv: Number(revStats.confirmed_gmv),
        total_amount_collected: Number(revStats.total_amount_collected),
        pending_balance_due_from_travelers: Number(revStats.pending_balance_due),
        net_operator_payout_after_commission: Number(revStats.net_operator_payout_earned)
      },
      leads_and_demand: {
        open_custom_enquiries_count: Number(enquiryStat.open_enquiries_count),
        waitlisted_seats_demand: Number(waitlistStat.waitlisted_seats_count)
      },
      upcoming_departures: upcomingDepartures.map((d) => ({
        ...d,
        needs_inventory_refresh_alert: Number(d.hours_since_inventory_sync) >= 24
      }))
    })
  );
});

