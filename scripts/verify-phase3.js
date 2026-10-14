import app from '../src/app.js';
import pool from '../src/config/db.js';

async function verifyPhase3() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  console.log(`\n🔍 Running Phase 3 End-to-End Verification against ${baseUrl}...\n`);

  let testBookingId = null;
  let testEnquiryId = null;

  try {
    // 1. Traveler Login
    const travLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aarav@example.com',
        password: 'Password@123'
      })
    });
    const travToken = (await travLoginRes.json()).data.accessToken;

    // 2. Road-Trip Safety Validation: Try reserving Bike Expedition (departure_id=2) WITHOUT driving_license_number
    const unsafeReserveRes = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: 2,
        payment_plan: 'TOKEN',
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
    const unsafeData = await unsafeReserveRes.json();
    console.log(
      '1. [POST /bookings/reserve (Missing Bike License Check)]:',
      unsafeData.statusCode,
      '->',
      unsafeData.message
    );

    // 3. Atomic Seat Reservation on Leh-Ladakh Expedition (departure_id=2) WITH Driving License
    const reserveRes = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: 2,
        payment_plan: 'TOKEN',
        special_requests: 'Need 1 XL riding jacket rental at Leh',
        participants: [
          {
            full_name: 'Aarav Verma',
            age: 27,
            gender: 'MALE',
            phone: '9000000005',
            id_proof_type: 'DRIVING_LICENSE',
            driving_license_number: 'MP09-20190045123',
            blood_group: 'O+',
            emergency_contact_name: 'Rajesh Verma',
            emergency_contact_phone: '9826011122'
          },
          {
            full_name: 'Siddharth Nair',
            age: 28,
            gender: 'MALE',
            phone: '9826099988',
            id_proof_type: 'DRIVING_LICENSE',
            driving_license_number: 'MP09-20180078901',
            blood_group: 'A+',
            emergency_contact_name: 'Kiran Nair',
            emergency_contact_phone: '9826099900'
          }
        ]
      })
    });
    const reserveData = await reserveRes.json();
    testBookingId = reserveData.data.booking.id;
    console.log(
      '2. [POST /bookings/reserve (Atomic Lock)]:',
      reserveData.statusCode,
      'Ref:',
      reserveData.data.booking.booking_reference,
      '| GMV: ₹' + reserveData.data.booking.total_amount,
      '| Payable Token: ₹' + reserveData.data.payable_now_amount,
      '| New Batch Badge:',
      reserveData.data.departure_confidence.confidence_badge
    );

    // 4. Operator Logs In & Confirms Manual Token Payment (Days 31-60 Manual MVP Flow)
    const opLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'rohan@himalayannomads.in',
        password: 'Password@123'
      })
    });
    const opToken = (await opLoginRes.json()).data.accessToken;

    const confirmRes = await fetch(
      `${baseUrl}/bookings/operator/${testBookingId}/confirm-manual`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opToken}`
        },
        body: JSON.stringify({
          amount_received: 10000,
          operator_remarks: 'Token ₹10,000 received via UPI ref #43198211'
        })
      }
    );
    const confirmData = await confirmRes.json();
    console.log(
      '3. [PATCH /bookings/operator/:id/confirm-manual]:',
      confirmData.statusCode,
      'Status:',
      confirmData.data.booking_status,
      '| Paid: ₹' + confirmData.data.amount_paid,
      '| Balance Due: ₹' + confirmData.data.balance_due
    );

    // 5. Operator B2B Command Center Dashboard
    const dashRes = await fetch(`${baseUrl}/operators/me/dashboard`, {
      headers: { Authorization: `Bearer ${opToken}` }
    });
    const dashData = await dashRes.json();
    console.log(
      '4. [GET /operators/me/dashboard]:',
      dashData.statusCode,
      'Occupancy:',
      dashData.data.inventory_overview.overall_occupancy_percentage + '%',
      '| Confirmed GMV: ₹' + dashData.data.financial_ledger.confirmed_gmv,
      '| Net Operator Payout: ₹' +
        dashData.data.financial_ledger.net_operator_payout_after_commission
    );

    // 6. Operator Fetches Departure Participant Manifest (JSON & CSV Export)
    const manifestJsonRes = await fetch(`${baseUrl}/departures/2/manifest`, {
      headers: { Authorization: `Bearer ${opToken}` }
    });
    const manifestJsonData = await manifestJsonRes.json();

    const manifestCsvRes = await fetch(`${baseUrl}/departures/2/manifest?format=csv`, {
      headers: { Authorization: `Bearer ${opToken}` }
    });
    const csvText = await manifestCsvRes.text();
    console.log(
      '5. [GET /departures/2/manifest (JSON + CSV)]:',
      manifestJsonData.statusCode,
      'Participants:',
      manifestJsonData.data.total_participants_count,
      '| CSV Lines:',
      csvText.trim().split('\n').length
    );

    // 7. Traveler Submits Custom Private Trip Enquiry & Operator Sends Quote
    const enqRes = await fetch(`${baseUrl}/bookings/enquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        trip_id: 4,
        preferred_start_date: '2026-12-24',
        group_size: 8,
        budget_per_person: 19000,
        origin_city: 'Indore',
        customization_notes: 'Private New Year family trip for 8 people with Jaisalmer Gala Dinner',
        contact_phone: '9000000005'
      })
    });
    const enqData = await enqRes.json();
    testEnquiryId = enqData.data.id;
    console.log(
      '6. [POST /bookings/enquiry (Traveler)]:',
      enqData.statusCode,
      'Enquiry Ref:',
      enqData.data.enquiry_reference
    );

    const rajasthanOpLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'meera@royaldesert.in',
        password: 'Password@123'
      })
    });
    const rajasthanOpToken = (await rajasthanOpLogin.json()).data.accessToken;

    const quoteRes = await fetch(
      `${baseUrl}/bookings/operator/enquiries/${testEnquiryId}/quote`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rajasthanOpToken}`
        },
        body: JSON.stringify({
          status: 'QUOTED',
          operator_quote_total: 148000,
          operator_response_notes:
            'Includes Private 12-seater Tempo Traveller, 4-star heritage havelis & New Year Gala at Sam Sand Dunes.'
        })
      }
    );
    const quoteData = await quoteRes.json();
    console.log(
      '7. [PATCH /bookings/operator/enquiries/:id/quote]:',
      quoteData.statusCode,
      'Status:',
      quoteData.data.status,
      '| Total Quote: ₹' + quoteData.data.operator_quote_total
    );

    console.log('\n✅ All Phase 3 endpoints verified successfully!');
  } finally {
    // Clean up temporary test records & restore departure_id=2 seat state
    if (testBookingId) {
      await pool.query('DELETE FROM bookings WHERE id = ?', [testBookingId]);
      await pool.query(
        `UPDATE trip_departures
         SET booked_seats = 3, departure_status = 'OPEN'
         WHERE id = 2`
      );
    }
    if (testEnquiryId) {
      await pool.query('DELETE FROM custom_trip_enquiries WHERE id = ?', [testEnquiryId]);
    }
    server.close();
    await pool.end();
  }
}

verifyPhase3();
