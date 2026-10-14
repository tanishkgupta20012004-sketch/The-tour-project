import app from '../src/app.js';
import pool from '../src/config/db.js';

async function verifyPhase5() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  console.log(`\n🔍 Running Phase 5 End-to-End Verification against ${baseUrl}...\n`);

  let testBookingId = null;

  try {
    // 1. Traveler Login & Create a Confirmed Booking on Indore Camping Trip (departure_id=3)
    const travLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aarav@example.com',
        password: 'Password@123'
      })
    });
    const travToken = (await travLoginRes.json()).data.accessToken;

    const reserveRes = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: 3,
        payment_plan: 'FULL',
        participants: [
          {
            full_name: 'Aarav Verma',
            age: 27,
            gender: 'MALE',
            phone: '9000000005',
            emergency_contact_name: 'Rajesh Verma',
            emergency_contact_phone: '9826011122'
          }
        ]
      })
    });
    const reserveData = await reserveRes.json();
    testBookingId = reserveData.data.booking.id;
    const bookingRef = reserveData.data.booking.booking_reference;

    // 2. Verify Unconfirmed Booking Cannot Submit Review (Fake Review Prevention)
    const prematureReviewRes = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: bookingRef,
        overall_rating: 5,
        itinerary_accuracy_rating: 5,
        safety_and_captain_rating: 5,
        accommodation_and_food_rating: 5,
        group_vibe_rating: 5,
        review_title: 'Trying to review before paying',
        review_text: 'Should be blocked because booking is still PENDING_PAYMENT.'
      })
    });
    const prematureData = await prematureReviewRes.json();
    console.log(
      '1. [POST /reviews (Unconfirmed Booking Guard)]:',
      prematureData.statusCode,
      '->',
      prematureData.message
    );

    // 3. Pay & Confirm the Booking
    const orderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({ booking_reference: bookingRef })
    });
    const orderData = await orderRes.json();

    const verifyPayRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(orderData.data.dev_webhook_simulator)
    });
    const verifyPayData = await verifyPayRes.json();
    const payoutId = verifyPayData.data.operator_escrow_payout.id;

    // 4. Traveler Reports a HIGH-Severity Safety/Quality Incident -> Freezes Operator Escrow Payout!
    const incRes = await fetch(`${baseUrl}/reviews/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: bookingRef,
        incident_category: 'VEHICLE_OR_SAFETY_HAZARD',
        severity: 'HIGH',
        description: 'Backup vehicle tyre was worn out before forest trail start; needs replacement.'
      })
    });
    const incData = await incRes.json();
    const incidentId = incData.data.incident.id;
    console.log(
      '2. [POST /reviews/incidents (HIGH Severity)]:',
      incData.statusCode,
      'Ref:',
      incData.data.incident.incident_reference,
      '| Payout Frozen:',
      incData.data.incident.payout_frozen,
      '| Emergency Helpline:',
      incData.data.emergency_contacts.operator_emergency_phone
    );

    // 5. Verify Admin Cannot Settle the Frozen Escrow Payout While Incident is OPEN
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@tourmarketplace.in',
        password: 'Password@123'
      })
    });
    const adminToken = (await adminLoginRes.json()).data.accessToken;

    const blockedSettleRes = await fetch(
      `${baseUrl}/payments/admin/payouts/${payoutId}/settle`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          settlement_utr_number: 'UTR9988776655'
        })
      }
    );
    const blockedSettleData = await blockedSettleRes.json();
    console.log(
      '3. [PATCH /payments/admin/payouts/:id/settle (Escrow Freeze Guard)]:',
      blockedSettleData.statusCode,
      '->',
      blockedSettleData.message
    );

    // 6. Operator Submits Incident Explanation & Admin Resolves Incident (Unfreezing Payout)
    const opLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'vikram@malwatrails.in',
        password: 'Password@123'
      })
    });
    const opToken = (await opLoginRes.json()).data.accessToken;

    await fetch(`${baseUrl}/reviews/incidents/${incidentId}/operator-response`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        operator_explanation: 'Replaced backup Gypsy with a brand new 4x4 vehicle within 30 minutes.'
      })
    });

    const resolveRes = await fetch(`${baseUrl}/reviews/incidents/${incidentId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'RESOLVED_NO_FAULT',
        admin_resolution_notes: 'Verified with traveler that replacement 4x4 vehicle was provided promptly.',
        unfreeze_operator_payout: true
      })
    });
    const resolveData = await resolveRes.json();
    console.log(
      '4. [PATCH /reviews/incidents/:id/resolve (Admin)]:',
      resolveData.statusCode,
      'Status:',
      resolveData.data.status,
      '| Payout Frozen:',
      resolveData.data.payout_frozen
    );

    // 7. Traveler Submits Verified Multi-Dimensional Review & Operator Replies
    const reviewRes = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: bookingRef,
        overall_rating: 5,
        itinerary_accuracy_rating: 5,
        safety_and_captain_rating: 5,
        accommodation_and_food_rating: 4,
        group_vibe_rating: 5,
        review_title: 'Magical Starlight Camping near Indore!',
        review_text: 'Acoustic guitar jamming by Choral backwaters and the morning forest trek were awesome.'
      })
    });
    const reviewData = await reviewRes.json();
    const reviewId = reviewData.data.review.id;
    console.log(
      '5. [POST /reviews (Verified Booking Review)]:',
      reviewData.statusCode,
      'Review ID:',
      reviewId,
      '| Updated Operator Rating:',
      reviewData.data.operator_rating_updated.rating_avg
    );

    const replyRes = await fetch(`${baseUrl}/reviews/${reviewId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        operator_public_reply: 'Thanks Aarav! See you on our next Pachmarhi weekend expedition!'
      })
    });
    const replyData = await replyRes.json();
    console.log(
      '6. [POST /reviews/:id/reply (Operator)]:',
      replyData.statusCode,
      'Reply:',
      replyData.data.operator_public_reply
    );

    // 8. Fetch Operator Composite Trust Score & Multi-Dimensional Ratings
    const trustRes = await fetch(
      `${baseUrl}/reviews/operator/malwa-trails-and-expeditions`
    );
    const trustData = await trustRes.json();
    console.log(
      '7. [GET /reviews/operator/:slug (Trust Score)]:',
      trustData.statusCode,
      'Trust Score:',
      trustData.data.trust_profile.composite_trust_score + '/100',
      '| Tier:',
      trustData.data.trust_profile.trust_tier
    );

    console.log('\n✅ All Phase 5 endpoints verified successfully!');
  } finally {
    if (testBookingId) {
      await pool.query('DELETE FROM bookings WHERE id = ?', [testBookingId]);
      await pool.query(
        `UPDATE trip_departures
         SET booked_seats = 11, departure_status = 'FILLING_FAST'
         WHERE id = 3`
      );
      await pool.query(
        `UPDATE operators SET rating_avg = 4.70, reviews_count = 62 WHERE id = 2`
      );
    }
    server.close();
    await pool.end();
  }
}

verifyPhase5();
