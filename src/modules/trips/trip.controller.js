import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createSlug } from '../../utils/slugify.js';
import { formatDepartureConfidence } from '../departures/departure.utils.js';
import {
  createTripSchema,
  updateTripSchema,
  updateTripStatusSchema
} from './trip.validation.js';

export const discoverTrips = asyncHandler(async (req, res) => {
  const {
    trip_category,
    origin_city,
    destination_city,
    experience_type,
    min_budget,
    max_budget,
    min_days,
    max_days,
    comfort_level,
    difficulty_level,
    pace_tag,
    accommodation_type,
    start_date_from,
    start_date_to,
    only_guaranteed,
    search,
    sort_by = 'rating_desc',
    page = 1,
    limit = 12
  } = req.query;

  const conditions = [`t.status = 'PUBLISHED'`];
  const params = [];

  if (trip_category) {
    conditions.push(`t.trip_category = ?`);
    params.push(trip_category);
  }
  if (origin_city) {
    conditions.push(`t.origin_city = ?`);
    params.push(origin_city);
  }
  if (destination_city) {
    conditions.push(`t.destination_city LIKE ?`);
    params.push(`%${destination_city}%`);
  }
  if (experience_type) {
    conditions.push(`t.experience_type LIKE ?`);
    params.push(`%${experience_type}%`);
  }
  if (min_budget) {
    conditions.push(`t.base_price >= ?`);
    params.push(Number(min_budget));
  }
  if (max_budget) {
    conditions.push(`t.base_price <= ?`);
    params.push(Number(max_budget));
  }
  if (min_days) {
    conditions.push(`t.duration_days >= ?`);
    params.push(Number(min_days));
  }
  if (max_days) {
    conditions.push(`t.duration_days <= ?`);
    params.push(Number(max_days));
  }
  if (comfort_level) {
    conditions.push(`t.comfort_level = ?`);
    params.push(comfort_level);
  }
  if (difficulty_level) {
    conditions.push(`t.difficulty_level = ?`);
    params.push(difficulty_level);
  }
  if (pace_tag) {
    conditions.push(`t.pace_tag = ?`);
    params.push(pace_tag);
  }
  if (accommodation_type) {
    conditions.push(`t.accommodation_type = ?`);
    params.push(accommodation_type);
  }
  if (search) {
    conditions.push(
      `(t.title LIKE ? OR t.destination_city LIKE ? OR t.origin_city LIKE ? OR t.experience_type LIKE ?)`
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (start_date_from) {
    conditions.push(
      `EXISTS (SELECT 1 FROM trip_departures td WHERE td.trip_id = t.id AND td.start_date >= ? AND td.departure_status NOT IN ('CANCELLED', 'COMPLETED'))`
    );
    params.push(start_date_from);
  }
  if (start_date_to) {
    conditions.push(
      `EXISTS (SELECT 1 FROM trip_departures td WHERE td.trip_id = t.id AND td.start_date <= ? AND td.departure_status NOT IN ('CANCELLED', 'COMPLETED'))`
    );
    params.push(start_date_to);
  }
  if (only_guaranteed === 'true') {
    conditions.push(
      `EXISTS (SELECT 1 FROM trip_departures td WHERE td.trip_id = t.id AND (td.booked_seats + td.offline_blocked_seats >= td.min_group_size OR td.departure_status = 'GUARANTEED'))`
    );
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sortMap = {
    price_asc: 't.base_price ASC',
    price_desc: 't.base_price DESC',
    duration_asc: 't.duration_days ASC',
    rating_desc: 'o.rating_avg DESC, o.total_completed_trips DESC',
    newest: 't.created_at DESC'
  };
  const orderBy = sortMap[sort_by] || sortMap.rating_desc;

  const pageNum = Math.max(1, Number(page));
  const pageSize = Math.min(50, Math.max(1, Number(limit)));
  const offset = (pageNum - 1) * pageSize;

  const [trips] = await pool.query(
    `SELECT
       t.id, t.title, t.slug, t.trip_category, t.experience_type,
       t.origin_city, t.destination_city, t.state_or_country,
       t.duration_days, t.duration_nights, t.base_price,
       t.comfort_level, t.difficulty_level, t.accommodation_type,
       t.pace_tag, t.vibe_tags, t.highlights, t.is_customizable_private,
       o.id AS operator_id, o.business_name AS operator_name, o.slug AS operator_slug,
       o.operator_type, o.kyc_status AS operator_kyc_status,
       o.rating_avg AS operator_rating, o.reviews_count AS operator_reviews_count,
       o.total_completed_trips AS operator_completed_trips
     FROM trips t
     JOIN operators o ON o.id = t.operator_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  // Attach upcoming departures & confidence metrics to each discovered trip
  if (trips.length > 0) {
    const tripIds = trips.map((t) => t.id);
    const [departures] = await pool.query(
      `SELECT *
       FROM trip_departures
       WHERE trip_id IN (?) AND departure_status NOT IN ('CANCELLED', 'COMPLETED')
       ORDER BY start_date ASC`,
      [tripIds]
    );

    const depByTrip = new Map();
    for (const dep of departures) {
      if (!depByTrip.has(dep.trip_id)) {
        depByTrip.set(dep.trip_id, []);
      }
      depByTrip.get(dep.trip_id).push(formatDepartureConfidence(dep));
    }

    for (const trip of trips) {
      const tripDeps = depByTrip.get(trip.id) || [];
      trip.upcoming_departures_count = tripDeps.length;
      trip.next_departure = tripDeps[0] || null;
      trip.upcoming_departures = tripDeps;
    }
  }

  return res.status(200).json(
    new ApiResponse(200, 'Trips discovered successfully', {
      count: trips.length,
      page: pageNum,
      limit: pageSize,
      trips
    })
  );
});

export const compareTrips = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  if (!ids) {
    throw new ApiError(400, 'Please provide comma-separated trip IDs, e.g. ?ids=1,2,3');
  }

  const tripIds = String(ids)
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => !Number.isNaN(id) && id > 0);

  if (tripIds.length < 2 || tripIds.length > 4) {
    throw new ApiError(400, 'Please select between 2 and 4 trips to compare side-by-side.');
  }

  const [trips] = await pool.query(
    `SELECT
       t.*,
       o.business_name AS operator_name, o.slug AS operator_slug,
       o.operator_type, o.kyc_status AS operator_kyc_status,
       o.rating_avg AS operator_rating, o.reviews_count AS operator_reviews_count,
       o.total_completed_trips AS operator_completed_trips,
       o.cancellation_rate_pct AS operator_cancellation_rate
     FROM trips t
     JOIN operators o ON o.id = t.operator_id
     WHERE t.id IN (?)`,
    [tripIds]
  );

  if (trips.length < 2) {
    throw new ApiError(404, 'Could not find enough valid trips for comparison.');
  }

  const [departures] = await pool.query(
    `SELECT *
     FROM trip_departures
     WHERE trip_id IN (?) AND departure_status NOT IN ('CANCELLED', 'COMPLETED')
     ORDER BY start_date ASC`,
    [tripIds]
  );

  const comparison = trips.map((trip) => {
    const tripDeps = departures
      .filter((d) => d.trip_id === trip.id)
      .map(formatDepartureConfidence);
    const nextDep = tripDeps[0] || null;

    return {
      trip_id: trip.id,
      title: trip.title,
      slug: trip.slug,
      trip_category: trip.trip_category,
      experience_type: trip.experience_type,
      route: `${trip.origin_city} → ${trip.destination_city}`,
      duration: {
        days: trip.duration_days,
        nights: trip.duration_nights,
        label: `${trip.duration_nights}N / ${trip.duration_days}D`
      },
      pricing: {
        base_price: trip.base_price,
        estimated_price_per_day: Math.round(trip.base_price / trip.duration_days),
        next_batch_price: nextDep ? nextDep.price_per_person : trip.base_price,
        token_booking_amount: nextDep ? nextDep.token_amount : null
      },
      experience_profile: {
        comfort_level: trip.comfort_level,
        difficulty_level: trip.difficulty_level,
        accommodation_type: trip.accommodation_type,
        pace_tag: trip.pace_tag,
        vibe_tags: trip.vibe_tags,
        is_customizable_private: Boolean(trip.is_customizable_private)
      },
      operator_trust: {
        name: trip.operator_name,
        slug: trip.operator_slug,
        operator_type: trip.operator_type,
        is_verified: trip.operator_kyc_status === 'VERIFIED',
        kyc_status: trip.operator_kyc_status,
        rating_avg: trip.operator_rating,
        reviews_count: trip.operator_reviews_count,
        total_completed_trips: trip.operator_completed_trips,
        cancellation_rate_pct: trip.operator_cancellation_rate
      },
      inclusions: trip.inclusions,
      exclusions: trip.exclusions,
      cancellation_policy: trip.cancellation_policy,
      safety_and_permits: trip.safety_and_permits,
      next_departure_confidence: nextDep ? nextDep.confidence_metrics : null,
      next_departure_date: nextDep ? nextDep.start_date : null
    };
  });

  return res.status(200).json(
    new ApiResponse(200, 'Side-by-side trip comparison generated', {
      compared_count: comparison.length,
      comparison
    })
  );
});

export const getTripBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const [tripRows] = await pool.query(
    `SELECT
       t.*,
       o.business_name AS operator_name, o.slug AS operator_slug,
       o.tagline AS operator_tagline, o.operator_type, o.base_city AS operator_base_city,
       o.instagram_handle AS operator_instagram, o.support_phone AS operator_support_phone,
       o.emergency_contact_phone AS operator_emergency_phone,
       o.kyc_status AS operator_kyc_status, o.verified_at AS operator_verified_at,
       o.rating_avg AS operator_rating, o.reviews_count AS operator_reviews_count,
       o.total_completed_trips AS operator_completed_trips,
       o.cancellation_rate_pct AS operator_cancellation_rate
     FROM trips t
     JOIN operators o ON o.id = t.operator_id
     WHERE t.slug = ?
     LIMIT 1`,
    [slug]
  );

  if (!tripRows.length) {
    throw new ApiError(404, 'Trip package not found.');
  }

  const trip = tripRows[0];

  const [itineraries] = await pool.query(
    `SELECT day_number, title, description, meals_included, accommodation_details, travel_distance_km
     FROM trip_itineraries
     WHERE trip_id = ?
     ORDER BY day_number ASC`,
    [trip.id]
  );

  const [departures] = await pool.query(
    `SELECT
       td.*,
       (SELECT COALESCE(SUM(dw.seats_interested), 0) FROM departure_waitlist dw WHERE dw.departure_id = td.id) AS interested_seats_count
     FROM trip_departures td
     WHERE td.trip_id = ?
     ORDER BY td.start_date ASC`,
    [trip.id]
  );

  const formattedDepartures = departures.map((dep) => ({
    ...formatDepartureConfidence(dep),
    interested_seats_count: Number(dep.interested_seats_count || 0)
  }));

  return res.status(200).json(
    new ApiResponse(200, 'Trip details fetched successfully', {
      trip,
      itineraries,
      departures: formattedDepartures
    })
  );
});

export const createTrip = asyncHandler(async (req, res) => {
  const payload = createTripSchema.parse(req.body);

  // Verify the logged-in user owns an operator profile
  const [opRows] = await pool.query(
    'SELECT id, kyc_status FROM operators WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );

  if (!opRows.length) {
    throw new ApiError(403, 'You must complete operator onboarding before creating trips.');
  }

  const operator = opRows[0];
  if (payload.status === 'PUBLISHED' && operator.kyc_status !== 'VERIFIED') {
    throw new ApiError(
      403,
      'Only KYC-verified operators can publish live trips. You may save the trip as DRAFT until verified.'
    );
  }

  let slug = createSlug(payload.title);
  const [slugExists] = await pool.query('SELECT id FROM trips WHERE slug = ? LIMIT 1', [slug]);
  if (slugExists.length) {
    slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const connection = await pool.getConnection();
  let tripId;
  try {
    await connection.beginTransaction();

    const [insertRes] = await connection.query(
      `INSERT INTO trips (
         operator_id, title, slug, trip_category, experience_type,
         origin_city, destination_city, state_or_country,
         duration_days, duration_nights, base_price,
         comfort_level, difficulty_level, accommodation_type,
         pace_tag, vibe_tags, highlights, inclusions, exclusions,
         cancellation_policy, safety_and_permits, is_customizable_private, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operator.id,
        payload.title,
        slug,
        payload.trip_category,
        payload.experience_type,
        payload.origin_city,
        payload.destination_city,
        payload.state_or_country,
        payload.duration_days,
        payload.duration_nights,
        payload.base_price,
        payload.comfort_level,
        payload.difficulty_level,
        payload.accommodation_type,
        payload.pace_tag,
        JSON.stringify(payload.vibe_tags),
        JSON.stringify(payload.highlights),
        JSON.stringify(payload.inclusions),
        JSON.stringify(payload.exclusions),
        JSON.stringify(payload.cancellation_policy),
        JSON.stringify(payload.safety_and_permits),
        payload.is_customizable_private,
        payload.status
      ]
    );
    tripId = insertRes.insertId;

    if (payload.itineraries && payload.itineraries.length > 0) {
      for (const day of payload.itineraries) {
        await connection.query(
          `INSERT INTO trip_itineraries (
             trip_id, day_number, title, description,
             meals_included, accommodation_details, travel_distance_km
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tripId,
            day.day_number,
            day.title,
            day.description,
            day.meals_included || null,
            day.accommodation_details || null,
            day.travel_distance_km ?? null
          ]
        );
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [createdTrip] = await pool.query('SELECT * FROM trips WHERE id = ? LIMIT 1', [tripId]);
  const [createdItineraries] = await pool.query(
    'SELECT * FROM trip_itineraries WHERE trip_id = ? ORDER BY day_number ASC',
    [tripId]
  );

  return res.status(201).json(
    new ApiResponse(201, 'Trip package created successfully', {
      trip: createdTrip[0],
      itineraries: createdItineraries
    })
  );
});

export const updateTrip = asyncHandler(async (req, res) => {
  const tripId = Number(req.params.id);
  const payload = updateTripSchema.parse(req.body);

  const [tripRows] = await pool.query(
    `SELECT t.*, o.user_id AS owner_user_id, o.kyc_status
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
    throw new ApiError(403, 'You do not have permission to modify this trip.');
  }

  if (payload.status === 'PUBLISHED' && trip.kyc_status !== 'VERIFIED') {
    throw new ApiError(403, 'Operator KYC must be VERIFIED before publishing a trip.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE trips SET
         title = COALESCE(?, title),
         trip_category = COALESCE(?, trip_category),
         experience_type = COALESCE(?, experience_type),
         origin_city = COALESCE(?, origin_city),
         destination_city = COALESCE(?, destination_city),
         duration_days = COALESCE(?, duration_days),
         duration_nights = COALESCE(?, duration_nights),
         base_price = COALESCE(?, base_price),
         comfort_level = COALESCE(?, comfort_level),
         difficulty_level = COALESCE(?, difficulty_level),
         accommodation_type = COALESCE(?, accommodation_type),
         pace_tag = COALESCE(?, pace_tag),
         vibe_tags = COALESCE(?, vibe_tags),
         highlights = COALESCE(?, highlights),
         inclusions = COALESCE(?, inclusions),
         exclusions = COALESCE(?, exclusions),
         cancellation_policy = COALESCE(?, cancellation_policy),
         safety_and_permits = COALESCE(?, safety_and_permits),
         is_customizable_private = COALESCE(?, is_customizable_private),
         status = COALESCE(?, status)
       WHERE id = ?`,
      [
        payload.title ?? null,
        payload.trip_category ?? null,
        payload.experience_type ?? null,
        payload.origin_city ?? null,
        payload.destination_city ?? null,
        payload.duration_days ?? null,
        payload.duration_nights ?? null,
        payload.base_price ?? null,
        payload.comfort_level ?? null,
        payload.difficulty_level ?? null,
        payload.accommodation_type ?? null,
        payload.pace_tag ?? null,
        payload.vibe_tags ? JSON.stringify(payload.vibe_tags) : null,
        payload.highlights ? JSON.stringify(payload.highlights) : null,
        payload.inclusions ? JSON.stringify(payload.inclusions) : null,
        payload.exclusions ? JSON.stringify(payload.exclusions) : null,
        payload.cancellation_policy ? JSON.stringify(payload.cancellation_policy) : null,
        payload.safety_and_permits ? JSON.stringify(payload.safety_and_permits) : null,
        payload.is_customizable_private ?? null,
        payload.status ?? null,
        tripId
      ]
    );

    if (Array.isArray(payload.itineraries)) {
      await connection.query('DELETE FROM trip_itineraries WHERE trip_id = ?', [tripId]);
      for (const day of payload.itineraries) {
        await connection.query(
          `INSERT INTO trip_itineraries (
             trip_id, day_number, title, description,
             meals_included, accommodation_details, travel_distance_km
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            tripId,
            day.day_number,
            day.title,
            day.description,
            day.meals_included || null,
            day.accommodation_details || null,
            day.travel_distance_km ?? null
          ]
        );
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [updated] = await pool.query('SELECT * FROM trips WHERE id = ? LIMIT 1', [tripId]);
  return res.status(200).json(
    new ApiResponse(200, 'Trip package updated successfully', updated[0])
  );
});

export const updateTripStatus = asyncHandler(async (req, res) => {
  const tripId = Number(req.params.id);
  const { status } = updateTripStatusSchema.parse(req.body);

  const [tripRows] = await pool.query(
    `SELECT t.id, t.status, o.user_id AS owner_user_id, o.kyc_status
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
    throw new ApiError(403, 'You do not have permission to change this trip status.');
  }

  if (status === 'PUBLISHED' && trip.kyc_status !== 'VERIFIED') {
    throw new ApiError(403, 'Only KYC-verified operators can publish trips.');
  }

  await pool.query('UPDATE trips SET status = ? WHERE id = ?', [status, tripId]);

  return res.status(200).json(
    new ApiResponse(200, `Trip status updated to ${status}`, { id: tripId, status })
  );
});

export const getMyOperatorTrips = asyncHandler(async (req, res) => {
  const [opRows] = await pool.query('SELECT id FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!opRows.length) {
    throw new ApiError(404, 'No operator profile found for this user.');
  }

  const [trips] = await pool.query(
    `SELECT
       t.*,
       (SELECT COUNT(*) FROM trip_departures td WHERE td.trip_id = t.id) AS total_departures_count
     FROM trips t
     WHERE t.operator_id = ?
     ORDER BY t.created_at DESC`,
    [opRows[0].id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator trips fetched successfully', {
      count: trips.length,
      trips
    })
  );
});
