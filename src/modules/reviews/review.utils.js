export function computeOperatorTrustScore({
  kyc_status,
  rating_avg,
  reviews_count,
  total_completed_trips,
  cancellation_rate_pct,
  open_high_severity_incidents = 0
}) {
  // 1. KYC & Legal Verification (Max 25 points)
  let kycScore = 0;
  if (kyc_status === 'VERIFIED') {
    kycScore = 25;
  } else if (kyc_status === 'UNDER_REVIEW') {
    kycScore = 10;
  }

  // 2. Verified Traveler Ratings (Max 40 points)
  const avgRating = Number(rating_avg || 0);
  const revCount = Number(reviews_count || 0);
  let ratingScore = 0;
  if (revCount > 0 && avgRating > 0) {
    const confidenceWeight = Math.min(1, revCount / 10); // Full weight once 10+ verified reviews
    ratingScore = Math.round((avgRating / 5) * 40 * (0.5 + 0.5 * confidenceWeight));
  } else {
    ratingScore = 15; // Baseline neutral score for newly verified operators
  }

  // 3. Departure Reliability / Low Cancellation Rate (Max 20 points)
  const cancelRate = Number(cancellation_rate_pct || 0);
  const reliabilityScore = Math.max(0, Math.round(20 - cancelRate * 1.5));

  // 4. Track Record / Completed Departures (Max 15 points)
  const completedTrips = Number(total_completed_trips || 0);
  const trackRecordScore = Math.min(15, Math.round((completedTrips / 50) * 15));

  // 5. Safety Incident Penalty
  const incidentPenalty = Number(open_high_severity_incidents || 0) * 15;

  const totalScore = Math.max(
    0,
    Math.min(100, kycScore + ratingScore + reliabilityScore + trackRecordScore - incidentPenalty)
  );

  let trustTier = 'NEW_ORGANIZER';
  if (kyc_status === 'VERIFIED' && totalScore >= 85) {
    trustTier = 'PLATINUM_VERIFIED';
  } else if (kyc_status === 'VERIFIED' && totalScore >= 70) {
    trustTier = 'GOLD_TRUSTED';
  } else if (kyc_status === 'VERIFIED') {
    trustTier = 'VERIFIED_ORGANIZER';
  }

  return {
    composite_trust_score: totalScore,
    max_score: 100,
    trust_tier: trustTier,
    score_breakdown: {
      kyc_verification_points: kycScore,
      verified_reviews_points: ratingScore,
      departure_reliability_points: reliabilityScore,
      completed_trips_track_record_points: trackRecordScore,
      active_incident_penalty_points: incidentPenalty
    }
  };
}
