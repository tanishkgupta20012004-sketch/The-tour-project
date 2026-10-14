const COMFORT_MAP = {
  BUDGET_BACKPACKER: 'BUDGET',
  STANDARD_COMFORT: 'STANDARD',
  PREMIUM_BOUTIQUE: 'PREMIUM'
};

export function computeTripCompatibilityMatch({ travelerPrefs, trip, compatProfile }) {
  if (!travelerPrefs) {
    return {
      match_score_percentage: 75,
      match_label: 'Good General Fit (Complete your vibe profile for personalized matching)',
      match_highlights: ['Popular verified package'],
      things_to_know: []
    };
  }

  let totalScore = 0;
  const matchHighlights = [];
  const thingsToKnow = [];

  // 1. Pace Alignment (Max 30 pts)
  const userPace = travelerPrefs.pace_preference || 'BALANCED';
  const tripPace = trip.pace_tag || 'BALANCED';
  let paceScore = 15;
  if (userPace === tripPace) {
    paceScore = 30;
    matchHighlights.push(`Exact pace match: ${tripPace.replace(/_/g, ' ')}`);
  } else if (userPace === 'BALANCED' || tripPace === 'BALANCED') {
    paceScore = 22;
    matchHighlights.push(`Compatible ${tripPace.toLowerCase()} pace`);
  } else {
    paceScore = 8;
    thingsToKnow.push(
      `This trip has a ${tripPace.replace(/_/g, ' ')} pace while your profile prefers ${userPace.replace(/_/g, ' ')}.`
    );
  }
  totalScore += paceScore;

  // 2. Social Style Alignment (Max 25 pts)
  const userSocial = travelerPrefs.social_style || 'BALANCED_SOCIAL';
  const tripSocial = compatProfile?.ideal_social_style || 'BALANCED_SOCIAL';
  let socialScore = 15;
  if (userSocial === tripSocial) {
    socialScore = 25;
    matchHighlights.push(`Matches your ${tripSocial.replace(/_/g, ' ').toLowerCase()} group style`);
  } else if (userSocial === 'BALANCED_SOCIAL' || tripSocial === 'BALANCED_SOCIAL') {
    socialScore = 18;
  } else {
    socialScore = 8;
    thingsToKnow.push(
      `Group social style is ${tripSocial.replace(/_/g, ' ').toLowerCase()}.`
    );
  }
  totalScore += socialScore;

  // 3. Morning Schedule Alignment (Max 15 pts)
  const userMorning = travelerPrefs.morning_style || 'FLEXIBLE';
  const tripMorning = compatProfile?.ideal_morning_style || 'FLEXIBLE';
  let morningScore = 10;
  if (userMorning === tripMorning || tripMorning === 'FLEXIBLE' || userMorning === 'FLEXIBLE') {
    morningScore = 15;
    if (userMorning === tripMorning && tripMorning !== 'FLEXIBLE') {
      matchHighlights.push(`Suits your ${tripMorning.replace(/_/g, ' ').toLowerCase()} schedule`);
    }
  } else {
    morningScore = 5;
    thingsToKnow.push(
      `Itinerary involves ${tripMorning.replace(/_/g, ' ').toLowerCase()} mornings.`
    );
  }
  totalScore += morningScore;

  // 4. Comfort & Stay Level Alignment (Max 15 pts)
  const mappedUserComfort = COMFORT_MAP[travelerPrefs.comfort_preference] || 'STANDARD';
  const tripComfort = trip.comfort_level || 'STANDARD';
  let comfortScore = 10;
  if (mappedUserComfort === tripComfort) {
    comfortScore = 15;
    matchHighlights.push(`Matches your ${tripComfort.toLowerCase()} stay comfort preference`);
  } else if (mappedUserComfort === 'STANDARD' || tripComfort === 'STANDARD') {
    comfortScore = 11;
  } else {
    comfortScore = 6;
  }
  totalScore += comfortScore;

  // 5. Trip Category & Home City Hub Fit (Max 15 pts)
  let categoryAndHubScore = 5;
  const preferredCategories = Array.isArray(travelerPrefs.preferred_trip_types)
    ? travelerPrefs.preferred_trip_types
    : typeof travelerPrefs.preferred_trip_types === 'string'
      ? JSON.parse(travelerPrefs.preferred_trip_types || '[]')
      : [];

  if (preferredCategories.includes(trip.trip_category)) {
    categoryAndHubScore += 6;
    matchHighlights.push(`In your preferred ${trip.trip_category.replace(/_/g, ' ').toLowerCase()} category`);
  }

  if (
    travelerPrefs.home_city &&
    trip.origin_city &&
    travelerPrefs.home_city.toLowerCase() === trip.origin_city.toLowerCase()
  ) {
    categoryAndHubScore += 4;
    matchHighlights.push(`Convenient departure from your home city (${trip.origin_city})`);
  }
  totalScore += Math.min(15, categoryAndHubScore);

  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  let matchLabel = 'Moderate Compatibility';
  if (finalScore >= 88) {
    matchLabel = 'Excellent Match • Ideal for Your Travel Vibe';
  } else if (finalScore >= 75) {
    matchLabel = 'Strong Match • Great Fit for Your Preferences';
  } else if (finalScore >= 60) {
    matchLabel = 'Good Match • Compatible Experience';
  }

  return {
    match_score_percentage: finalScore,
    match_label: matchLabel,
    dimension_scores: {
      pace_alignment_score: `${paceScore}/30`,
      social_vibe_score: `${socialScore}/25`,
      morning_schedule_score: `${morningScore}/15`,
      comfort_fit_score: `${comfortScore}/15`,
      category_and_origin_hub_score: `${Math.min(15, categoryAndHubScore)}/15`
    },
    match_highlights: matchHighlights,
    things_to_know: thingsToKnow
  };
}

export function buildAnonymizedGroupInsights({
  departure,
  trip,
  compatProfile,
  participantRows
}) {
  const totalSeats = Number(departure.total_seats || 0);
  const occupiedSeats =
    Number(departure.booked_seats || 0) + Number(departure.offline_blocked_seats || 0);
  const availableSeats = Math.max(0, totalSeats - occupiedSeats);

  const count = participantRows.length;
  if (count === 0) {
    return {
      departure_id: departure.id,
      batch_code: departure.batch_code,
      total_occupied_seats: occupiedSeats,
      available_seats: availableSeats,
      platform_participants_analyzed: 0,
      solo_friendly: Boolean(compatProfile?.solo_traveler_friendly ?? true),
      group_vibe_summary:
        compatProfile?.group_vibe_summary ||
        `${trip.pace_tag.replace(/_/g, ' ')} group experience`,
      privacy_safe_headline:
        occupiedSeats > 0
          ? `${occupiedSeats} seat(s) booked offline • Be the first platform traveler to join this batch!`
          : 'Open batch • Be the first to set the group vibe!'
    };
  }

  const ages = participantRows.map((p) => Number(p.age)).filter((a) => a > 0);
  const minAge = ages.length ? Math.min(...ages) : null;
  const maxAge = ages.length ? Math.max(...ages) : null;
  const avgAge = ages.length
    ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
    : null;

  const genderBreakdown = { MALE: 0, FEMALE: 0, NON_BINARY: 0, OTHER: 0 };
  const citiesSet = new Set();
  let soloOrPairParticipants = 0;

  for (const p of participantRows) {
    if (genderBreakdown[p.gender] !== undefined) {
      genderBreakdown[p.gender]++;
    }
    if (p.home_city) {
      citiesSet.add(p.home_city);
    }
    if (Number(p.booking_seats_count) <= 2) {
      soloOrPairParticipants++;
    }
  }

  const soloOrSmallGroupPct = Math.round((soloOrPairParticipants / count) * 100);
  const citiesRepresented = Array.from(citiesSet);

  const headlineParts = [
    `${occupiedSeats}/${totalSeats} seats filled`,
    minAge && maxAge ? `Ages ${minAge}–${maxAge} (Avg ${avgAge})` : null,
    `${soloOrSmallGroupPct}% solo or duo travelers`,
    citiesRepresented.length ? `From ${citiesRepresented.join(', ')}` : null
  ].filter(Boolean);

  return {
    departure_id: departure.id,
    batch_code: departure.batch_code,
    total_occupied_seats: occupiedSeats,
    available_seats: availableSeats,
    platform_participants_analyzed: count,
    solo_friendly: Boolean(compatProfile?.solo_traveler_friendly ?? true),
    solo_or_duo_travelers_percentage: soloOrSmallGroupPct,
    age_demographics: {
      min_age: minAge,
      max_age: maxAge,
      average_age: avgAge
    },
    gender_distribution: genderBreakdown,
    cities_represented: citiesRepresented,
    trip_vibe_expectations: {
      pace: trip.pace_tag,
      ideal_morning_style: compatProfile?.ideal_morning_style || 'FLEXIBLE',
      ideal_social_style: compatProfile?.ideal_social_style || 'BALANCED_SOCIAL',
      activity_intensity_level: compatProfile?.activity_intensity_level || 3,
      group_vibe_summary:
        compatProfile?.group_vibe_summary ||
        'Friendly curated group with experienced trip captain'
    },
    privacy_safe_headline: headlineParts.join(' • ')
  };
}
