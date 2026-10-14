import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { formatDepartureConfidence } from '../departures/departure.utils.js';
import {
  buildAnonymizedGroupInsights,
  computeTripCompatibilityMatch
} from './compatibility.utils.js';
import { upsertTripCompatibilityProfileSchema } from './compatibility.validation.js';

export const getPersonalizedTripRecommendations = asyncHandler(async (req, res) => {
  const { origin_city, trip_category, max_budget } = req.query;

  const [prefRows] = await pool.query(
    'SELECT * FROM traveler_preferences WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );
  const travelerPrefs = prefRows[0] || null;

  const conditions = [`t.status = 'PUBLISHED'`];
  const params = [];

  if (origin_city) {
    conditions.push('t.origin_city = ?');
    params.push(origin_city);
  }
  if (trip_category) {
    conditions.push('t.trip_category = ?');
    params.push(trip_category);
  }
  if (max_budget) {
    conditions.push('t.base_price <= ?');
    params.push(Number(max_budget));
  }

  const [trips] = await pool.query(
    `SELECT
       t.*,
       o.business_name AS operator_name, o.slug AS operator_slug,
       o.kyc_status AS operator_kyc_status, o.rating_avg AS operator_rating,
       tcp.ideal_morning_style, tcp.ideal_social_style, tcp.solo_traveler_friendly,
       tcp.ideal_age_brackets, tcp.activity_intensity_level, tcp.group_vibe_summary
     FROM trips t
     JOIN operators o ON o.id = t.operator_id
     LEFT JOIN trip_compatibility_profiles tcp ON tcp.trip_id = t.id
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  // Fetch upcoming departures for these trips
  const tripIds = trips.map((t) => t.id);
  const depByTrip = new Map();
  if (tripIds.length > 0) {
    const [departures] = await pool.query(
      `SELECT *
       FROM trip_departures
       WHERE trip_id IN (?) AND departure_status NOT IN ('CANCELLED', 'COMPLETED')
       ORDER BY start_date ASC`,
      [tripIds]
    );
    for (const d of departures) {
      if (!depByTrip.has(d.trip_id)) {
        depByTrip.set(d.trip_id, []);
      }
      depByTrip.get(d.trip_id).push(formatDepartureConfidence(d));
    }
  }

  const scoredTrips = trips
    .map((trip) => {
      const compatProfile = {
        ideal_morning_style: trip.ideal_morning_style,
        ideal_social_style: trip.ideal_social_style,
        solo_traveler_friendly: trip.solo_traveler_friendly,
        ideal_age_brackets: trip.ideal_age_brackets,
        activity_intensity_level: trip.activity_intensity_level,
        group_vibe_summary: trip.group_vibe_summary
      };

      const compatibility = computeTripCompatibilityMatch({
        travelerPrefs,
        trip,
        compatProfile
      });

      const upcomingDeps = depByTrip.get(trip.id) || [];

      return {
        trip_id: trip.id,
        title: trip.title,
        slug: trip.slug,
        trip_category: trip.trip_category,
        experience_type: trip.experience_type,
        origin_city: trip.origin_city,
        destination_city: trip.destination_city,
        duration_days: trip.duration_days,
        duration_nights: trip.duration_nights,
        base_price: trip.base_price,
        comfort_level: trip.comfort_level,
        difficulty_level: trip.difficulty_level,
        pace_tag: trip.pace_tag,
        vibe_tags: trip.vibe_tags,
        operator: {
          name: trip.operator_name,
          slug: trip.operator_slug,
          is_verified: trip.operator_kyc_status === 'VERIFIED',
          rating_avg: trip.operator_rating
        },
        compatibility_match: compatibility,
        next_departure: upcomingDeps[0] || null
      };
    })
    .sort(
      (a, b) =>
        b.compatibility_match.match_score_percentage -
        a.compatibility_match.match_score_percentage
    );

  return res.status(200).json(
    new ApiResponse(
      200,
      'Personalized trip recommendations ranked by Travel Compatibility Match Score',
      {
        traveler_vibe_profile: travelerPrefs,
        recommended_count: scoredTrips.length,
        recommendations: scoredTrips
      }
    )
  );
});

export const checkTripCompatibilityForUser = asyncHandler(async (req, res) => {
  const tripId = Number(req.params.tripId);

  const [tripRows] = await pool.query(
    `SELECT
       t.*,
       tcp.ideal_morning_style, tcp.ideal_social_style, tcp.solo_traveler_friendly,
       tcp.ideal_age_brackets, tcp.activity_intensity_level, tcp.group_vibe_summary
     FROM trips t
     LEFT JOIN trip_compatibility_profiles tcp ON tcp.trip_id = t.id
     WHERE t.id = ?
     LIMIT 1`,
    [tripId]
  );

  if (!tripRows.length) {
    throw new ApiError(404, 'Trip not found.');
  }

  const trip = tripRows[0];
  const [prefRows] = await pool.query(
    'SELECT * FROM traveler_preferences WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );

  const compatibility = computeTripCompatibilityMatch({
    travelerPrefs: prefRows[0] || null,
    trip,
    compatProfile: trip
  });

  return res.status(200).json(
    new ApiResponse(200, 'Detailed 5-dimension trip compatibility analysis generated', {
      trip: {
        id: trip.id,
        title: trip.title,
        slug: trip.slug,
        trip_category: trip.trip_category,
        origin_city: trip.origin_city,
        destination_city: trip.destination_city,
        pace_tag: trip.pace_tag,
        comfort_level: trip.comfort_level
      },
      traveler_preferences: prefRows[0] || null,
      compatibility
    })
  );
});

export const getDepartureGroupInsights = asyncHandler(async (req, res) => {
  const departureId = Number(req.params.departureId || req.params.id);

  const [depRows] = await pool.query(
    `SELECT
       td.*,
       t.title AS trip_title, t.slug AS trip_slug, t.trip_category,
       t.pace_tag, t.comfort_level, t.origin_city, t.destination_city,
       tcp.ideal_morning_style, tcp.ideal_social_style, tcp.solo_traveler_friendly,
       tcp.ideal_age_brackets, tcp.activity_intensity_level, tcp.group_vibe_summary
     FROM trip_departures td
     JOIN trips t ON t.id = td.trip_id
     LEFT JOIN trip_compatibility_profiles tcp ON tcp.trip_id = t.id
     WHERE td.id = ?
     LIMIT 1`,
    [departureId]
  );

  if (!depRows.length) {
    throw new ApiError(404, 'Departure batch not found.');
  }

  const dep = depRows[0];

  // Fetch anonymized participant & preference fields for CONFIRMED/COMPLETED bookings on this batch
  const [participants] = await pool.query(
    `SELECT
       bp.age, bp.gender,
       b.seats_count AS booking_seats_count,
       tp.home_city, tp.pace_preference, tp.social_style, tp.morning_style
     FROM booking_participants bp
     JOIN bookings b ON b.id = bp.booking_id
     LEFT JOIN traveler_preferences tp ON tp.user_id = b.user_id
     WHERE b.departure_id = ?
       AND b.booking_status IN ('CONFIRMED', 'COMPLETED')`,
    [departureId]
  );

  const insights = buildAnonymizedGroupInsights({
    departure: dep,
    trip: dep,
    compatProfile: dep,
    participantRows: participants
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      'Anonymized "Who is in this group" departure insights fetched',
      insights
    )
  );
});

export const upsertTripCompatibilityProfile = asyncHandler(async (req, res) => {
  const tripId = Number(req.params.tripId);
  const payload = upsertTripCompatibilityProfileSchema.parse(req.body);

  const [tripRows] = await pool.query(
    `SELECT t.id, o.user_id AS owner_user_id
     FROM trips t
     JOIN operators o ON o.id = t.operator_id
     WHERE t.id = ?
     LIMIT 1`,
    [tripId]
  );

  if (!tripRows.length) {
    throw new ApiError(404, 'Trip not found.');
  }

  if (req.user.role !== 'ADMIN' && tripRows[0].owner_user_id !== req.user.id) {
    throw new ApiError(403, 'Only the trip operator or admin can configure this compatibility profile.');
  }

  await pool.query(
    `INSERT INTO trip_compatibility_profiles (
       trip_id, ideal_morning_style, ideal_social_style,
       solo_traveler_friendly, ideal_age_brackets,
       activity_intensity_level, group_vibe_summary
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ideal_morning_style = VALUES(ideal_morning_style),
       ideal_social_style = VALUES(ideal_social_style),
       solo_traveler_friendly = VALUES(solo_traveler_friendly),
       ideal_age_brackets = VALUES(ideal_age_brackets),
       activity_intensity_level = VALUES(activity_intensity_level),
       group_vibe_summary = VALUES(group_vibe_summary)`,
    [
      tripId,
      payload.ideal_morning_style,
      payload.ideal_social_style,
      payload.solo_traveler_friendly,
      JSON.stringify(payload.ideal_age_brackets),
      payload.activity_intensity_level,
      payload.group_vibe_summary
    ]
  );

  const [rows] = await pool.query(
    'SELECT * FROM trip_compatibility_profiles WHERE trip_id = ? LIMIT 1',
    [tripId]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Trip compatibility & vibe profile saved', rows[0])
  );
});
