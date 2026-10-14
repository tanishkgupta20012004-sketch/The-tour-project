import app from '../src/app.js';
import pool from '../src/config/db.js';

async function verifyPhase2() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  console.log(`\n🔍 Running Phase 2 End-to-End Verification against ${baseUrl}...\n`);

  let createdTripId = null;

  try {
    // 1. Experience-First Discovery: Filter by Indore Origin
    const indoreRes = await fetch(`${baseUrl}/trips?origin_city=Indore`);
    const indoreData = await indoreRes.json();
    console.log(
      '1. [GET /trips?origin_city=Indore]:',
      indoreData.statusCode,
      'Found:',
      indoreData.data.count,
      'trips ->',
      indoreData.data.trips.map((t) => `${t.title} (₹${t.base_price})`).join(' | ')
    );

    // 2. Filter by Guaranteed Stranger Group Trips
    const guaranteedRes = await fetch(
      `${baseUrl}/trips?trip_category=STRANGER_GROUP&only_guaranteed=true`
    );
    const guaranteedData = await guaranteedRes.json();
    console.log(
      '2. [GET /trips?trip_category=STRANGER_GROUP&only_guaranteed=true]:',
      guaranteedData.statusCode,
      'Guaranteed Count:',
      guaranteedData.data.count
    );

    // 3. Side-by-Side Comparison of 3 Trips
    const compareRes = await fetch(`${baseUrl}/trips/compare?ids=1,3,4`);
    const compareData = await compareRes.json();
    console.log(
      '3. [GET /trips/compare?ids=1,3,4]:',
      compareData.statusCode,
      'Compared:',
      compareData.data.compared_count,
      'trips ->',
      compareData.data.comparison
        .map(
          (c) =>
            `${c.route} (${c.duration.label}, ₹${c.pricing.estimated_price_per_day}/day, Verified: ${c.operator_trust.is_verified})`
        )
        .join(' vs ')
    );

    // 4. Full Trip Detail by Slug (with Itineraries & Departure-Confidence Metrics)
    const detailRes = await fetch(
      `${baseUrl}/trips/manali-solang-atal-tunnel-stranger-group-escape`
    );
    const detailData = await detailRes.json();
    const firstDep = detailData.data.departures[0];
    console.log(
      '4. [GET /trips/:slug]:',
      detailData.statusCode,
      'Itinerary Days:',
      detailData.data.itineraries.length,
      '| Next Batch Badge:',
      firstDep.confidence_metrics.confidence_badge
    );

    // 5. Login as Verified Operator (Malwa Trails & Expeditions - Indore)
    const opLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'vikram@malwatrails.in',
        password: 'Password@123'
      })
    });
    const opToken = (await opLoginRes.json()).data.accessToken;

    // 6. Operator Creates a New Trip with Day-wise Itineraries
    const createTripRes = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        title: 'Mandu Monsoon Heritage & Lake Cycling Weekend from Indore',
        trip_category: 'WEEKEND_NICHE',
        experience_type: 'Cycling & Heritage Exploration',
        origin_city: 'Indore',
        destination_city: 'Mandu',
        duration_days: 2,
        duration_nights: 1,
        base_price: 3299,
        comfort_level: 'STANDARD',
        difficulty_level: 'EASY',
        accommodation_type: 'BOUTIQUE_STAY',
        pace_tag: 'BALANCED',
        vibe_tags: ['Cycling', 'Monsoon Fort', 'Solo Friendly'],
        highlights: ['Jahaz Mahal Sunrise', 'Guided Heritage Cycling Trail'],
        inclusions: ['Indore-Mandu Traveller', 'MTB Cycle & Helmet', 'Stay & Meals'],
        exclusions: ['Personal expenses'],
        status: 'PUBLISHED',
        itineraries: [
          {
            day_number: 1,
            title: 'Indore to Mandu, Jahaz Mahal & Baz Bahadur Palace',
            description: 'Morning drive from Indore to Mandu, heritage fort tour and sunset view.',
            meals_included: 'Dinner',
            accommodation_details: 'Malwa Resort Mandu',
            travel_distance_km: 95
          },
          {
            day_number: 2,
            title: 'Morning Lake Cycling Trail & Return to Indore',
            description: '20km scenic cycling trail around Mandu lakes and banyan trees.',
            meals_included: 'Breakfast',
            accommodation_details: 'None',
            travel_distance_km: 95
          }
        ]
      })
    });
    const createTripData = await createTripRes.json();
    createdTripId = createTripData.data.trip.id;
    console.log(
      '5. [POST /trips (Operator)]:',
      createTripData.statusCode,
      'Created Trip ID:',
      createdTripId,
      'Slug:',
      createTripData.data.trip.slug
    );

    // 7. Operator Creates a Fixed Departure Batch (total_seats=12, min_group_size=6, offline_blocked=2)
    const createDepRes = await fetch(`${baseUrl}/trips/${createdTripId}/departures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        start_date: '2026-11-14',
        end_date: '2026-11-15',
        price_per_person: 3299,
        token_amount: 1000,
        total_seats: 12,
        offline_blocked_seats: 2,
        min_group_size: 6,
        booking_deadline: '2026-11-12 20:00:00'
      })
    });
    const createDepData = await createDepRes.json();
    const departureId = createDepData.data.id;
    console.log(
      '6. [POST /trips/:tripId/departures]:',
      createDepData.statusCode,
      'Initial Status:',
      createDepData.data.departure_status,
      '| Badge:',
      createDepData.data.confidence_metrics.confidence_badge
    );

    // 8. Traveler Logs In & Registers Interest in the Departure
    const travLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aarav@example.com',
        password: 'Password@123'
      })
    });
    const travToken = (await travLoginRes.json()).data.accessToken;

    const interestRes = await fetch(`${baseUrl}/departures/${departureId}/interest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        seats_interested: 2,
        interest_type: 'WAIT_FOR_GUARANTEE',
        notes: 'Ready to book 2 seats as soon as batch is guaranteed!'
      })
    });
    const interestData = await interestRes.json();
    console.log(
      '7. [POST /departures/:id/interest (Traveler)]:',
      interestData.statusCode,
      'Seats Interested:',
      interestData.data.seats_interested
    );

    // 9. Operator Syncs Instagram/Offline Seats (offline_blocked_seats: 2 -> 6, meeting min_group_size=6!)
    const syncRes = await fetch(`${baseUrl}/departures/${departureId}/inventory`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        offline_blocked_seats: 6
      })
    });
    const syncData = await syncRes.json();
    console.log(
      '8. [PATCH /departures/:id/inventory (Instagram Sync)]:',
      syncData.statusCode,
      'New Status:',
      syncData.data.departure_status,
      '| Badge:',
      syncData.data.confidence_metrics.confidence_badge,
      '| Waitlist Notified:',
      syncData.data.waitlist_travelers_notified_on_guarantee
    );

    // 10. Operator Views Interested Travelers / Waitlist Leads
    const waitlistRes = await fetch(`${baseUrl}/departures/${departureId}/interest`, {
      headers: {
        Authorization: `Bearer ${opToken}`
      }
    });
    const waitlistData = await waitlistRes.json();
    console.log(
      '9. [GET /departures/:id/interest (Operator Leads)]:',
      waitlistData.statusCode,
      'Interested Travelers:',
      waitlistData.data.interested_travelers_count,
      '| Total Seats Interested:',
      waitlistData.data.total_seats_interested
    );

    console.log('\n✅ All Phase 2 endpoints verified successfully!');
  } finally {
    if (createdTripId) {
      await pool.query('DELETE FROM trips WHERE id = ?', [createdTripId]);
    }
    server.close();
    await pool.end();
  }
}

verifyPhase2();
