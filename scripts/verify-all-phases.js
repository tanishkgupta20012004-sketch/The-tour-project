import assert from 'node:assert/strict';
import app from '../src/app.js';
import pool from '../src/config/db.js';

async function runMasterE2ETestSuite() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const results = [];
  const recordPass = (code, description, detail) => {
    results.push({ code, status: 'PASS', description, detail });
    console.log(`  ✅ [${code}] ${description} -> ${detail}`);
  };

  console.log('================================================================================');
  console.log('🚀 MASTER END-TO-END TEST SUITE (ALL 6 PHASES) — TOUR MARKETPLACE BACKEND');
  console.log(`🌐 Target Server: ${baseUrl}`);
  console.log('================================================================================\n');

  let tempUserPhone = null;
  let createdTripId = null;
  let phase3BookingId = null;
  let phase3EnquiryId = null;
  let phase4BookingId = null;
  let phase4TempDepartureId = null;
  let phase5BookingId = null;

  try {
    // ========================================================================
    // PHASE 1: FOUNDATION, AUTH, RBAC & OPERATOR ONBOARDING
    // ========================================================================
    console.log('--- PHASE 1: Foundation, Auth, RBAC & Operator Onboarding ---');

    // P1.1 Health Check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    assert.equal(healthRes.status, 200);
    assert.equal(healthData.data.database, 'CONNECTED');
    recordPass('P1.1', 'Health Check & MySQL Pool Connectivity', `DB: ${healthData.data.database_name}`);

    // P1.2 & P1.3 Mobile OTP Send & Verify
    tempUserPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const otpSendRes = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: tempUserPhone, purpose: 'REGISTER' })
    });
    const otpSendData = await otpSendRes.json();
    assert.equal(otpSendRes.status, 200);
    assert.equal(otpSendData.data.dev_otp_code.length, 6);
    recordPass('P1.2', 'Send 6-Digit Mobile OTP', `Phone: ${tempUserPhone}, OTP: ${otpSendData.data.dev_otp_code}`);

    const otpVerifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: tempUserPhone,
        otp_code: otpSendData.data.dev_otp_code,
        full_name: 'Devika Sharma (Satpura Treks)'
      })
    });
    const otpVerifyData = await otpVerifyRes.json();
    assert.equal(otpVerifyRes.status, 200);
    assert.ok(otpVerifyData.data.accessToken);
    const tempUserToken = otpVerifyData.data.accessToken;
    recordPass('P1.3', 'Verify OTP & Auto-Provision Traveler Account', `User ID: ${otpVerifyData.data.user.id}, Role: ${otpVerifyData.data.user.role}`);

    // P1.4 Traveler Compatibility Preferences Update
    const prefRes = await fetch(`${baseUrl}/auth/me/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempUserToken}`
      },
      body: JSON.stringify({
        pace_preference: 'HIGH_ADVENTURE',
        morning_style: 'EARLY_BIRD',
        social_style: 'HIGH_ENERGY_GROUP',
        comfort_preference: 'STANDARD_COMFORT',
        preferred_trip_types: ['STRANGER_GROUP', 'BIKE_CAR_EXPEDITION'],
        home_city: 'Indore'
      })
    });
    const prefData = await prefRes.json();
    assert.equal(prefRes.status, 200);
    assert.equal(prefData.data.home_city, 'Indore');
    recordPass('P1.4', 'Update Traveler Vibe & Compatibility Profile', `Pace: ${prefData.data.pace_preference}, City: ${prefData.data.home_city}`);

    // P1.5 Operator Onboarding Application
    const onboardRes = await fetch(`${baseUrl}/operators/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempUserToken}`
      },
      body: JSON.stringify({
        business_name: `Satpura Adventure Club ${tempUserPhone.slice(-4)}`,
        tagline: 'Offbeat forest treks & road trips from Indore',
        operator_type: 'TRAVEL_COMMUNITY',
        base_city: 'Indore',
        operating_regions: ['Madhya Pradesh', 'Maharashtra'],
        instagram_handle: '@satpura_adventure_club',
        support_phone: tempUserPhone,
        emergency_contact_phone: '9826012345',
        gst_number: '23AAAAA0000A1Z5',
        pan_number: 'AAAAA0000A'
      })
    });
    const onboardData = await onboardRes.json();
    assert.equal(onboardRes.status, 201);
    assert.equal(onboardData.data.kyc_status, 'PENDING');
    const newOperatorId = onboardData.data.id;
    recordPass('P1.5', 'Operator Onboarding Submission & Role Upgrade', `Operator ID: ${newOperatorId}, KYC: ${onboardData.data.kyc_status}`);

    // P1.6 RBAC Guard: Non-Admin Cannot Approve Operator KYC
    const rbacFailRes = await fetch(`${baseUrl}/operators/${newOperatorId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempUserToken}`
      },
      body: JSON.stringify({ kyc_status: 'VERIFIED' })
    });
    assert.equal(rbacFailRes.status, 403);
    recordPass('P1.6', 'RBAC Security Guard (Non-Admin Blocked from KYC Approval)', 'HTTP 403 Forbidden enforced');

    // P1.7 Admin Approves Operator KYC & Checks Audit Trail
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@tourmarketplace.in', password: 'Password@123' })
    });
    const adminToken = (await adminLoginRes.json()).data.accessToken;

    const kycApproveRes = await fetch(`${baseUrl}/operators/${newOperatorId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        kyc_status: 'VERIFIED',
        remarks: 'Verified GST, PAN and emergency contact details.',
        commission_rate_pct: 10
      })
    });
    const kycApproveData = await kycApproveRes.json();
    assert.equal(kycApproveRes.status, 200);
    assert.equal(kycApproveData.data.kyc_status, 'VERIFIED');

    const auditRes = await fetch(`${baseUrl}/operators/${newOperatorId}/verification-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const auditData = await auditRes.json();
    assert.equal(auditRes.status, 200);
    assert.ok(auditData.data.length >= 1);
    recordPass('P1.7', 'Admin KYC Verification & Audit Trail Logging', `Status: ${kycApproveData.data.kyc_status}, Audit Logs: ${auditData.data.length}`);

    // ========================================================================
    // PHASE 2: TRIP CATALOGUE, DISCOVERY FILTERS & DEPARTURE-CONFIDENCE
    // ========================================================================
    console.log('\n--- PHASE 2: Trip Catalogue, Discovery Filters & Departure-Confidence ---');

    // P2.1 Unverified Operator Guard (Operator #3 Royal Desert is PENDING KYC)
    const unverifiedOpLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'meera@royaldesert.in', password: 'Password@123' })
    });
    const unverifiedOpToken = (await unverifiedOpLogin.json()).data.accessToken;

    const blockedPublishRes = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unverifiedOpToken}`
      },
      body: JSON.stringify({
        title: 'Jaisalmer Desert Festival Group Tour',
        trip_category: 'STRANGER_GROUP',
        experience_type: 'Desert Camping',
        origin_city: 'Jaipur',
        destination_city: 'Jaisalmer',
        duration_days: 3,
        duration_nights: 2,
        base_price: 8999,
        inclusions: ['Stay', 'Meals'],
        exclusions: ['Flights'],
        status: 'PUBLISHED'
      })
    });
    assert.equal(blockedPublishRes.status, 403);
    recordPass('P2.1', 'Unverified Operator Guard (Blocked from Publishing Live Trips)', 'HTTP 403 Forbidden enforced');

    // P2.2 Verified Operator Creates Trip + Day-by-Day Itineraries
    const opLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'vikram@malwatrails.in', password: 'Password@123' })
    });
    const opToken = (await opLoginRes.json()).data.accessToken;

    const createTripRes = await fetch(`${baseUrl}/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        title: 'Tamia Patalkot Hidden Valley Trek & Camping from Indore',
        trip_category: 'WEEKEND_NICHE',
        experience_type: 'Valley Trekking & Camping',
        origin_city: 'Indore',
        destination_city: 'Tamia / Patalkot',
        duration_days: 3,
        duration_nights: 2,
        base_price: 4999,
        comfort_level: 'BUDGET',
        difficulty_level: 'MODERATE',
        accommodation_type: 'CAMPING',
        pace_tag: 'HIGH_ADVENTURE',
        vibe_tags: ['Hidden Valley', 'Starlight Camp', 'Indore Departure'],
        highlights: ['Patalkot Viewpoint', 'Ridge Trek'],
        inclusions: ['Indore Traveller', 'Camping Gear', 'Meals'],
        exclusions: ['Personal snacks'],
        status: 'PUBLISHED',
        itineraries: [
          { day_number: 1, title: 'Indore to Tamia Basecamp', description: 'Overnight journey and ridge walk.', meals_included: 'Dinner' },
          { day_number: 2, title: 'Patalkot Gorge Exploration', description: 'Guided descent into Patalkot valley.', meals_included: 'Breakfast, Dinner' },
          { day_number: 3, title: 'Sunrise Point & Return to Indore', description: 'Morning viewpoint and drive back.', meals_included: 'Breakfast' }
        ]
      })
    });
    const createTripData = await createTripRes.json();
    assert.equal(createTripRes.status, 201);
    createdTripId = createTripData.data.trip.id;
    recordPass('P2.2', 'Create Trip Package with Day-by-Day Itineraries', `Trip ID: ${createdTripId}, Itinerary Days: ${createTripData.data.itineraries.length}`);

    // P2.3 Create Fixed Departure Batch + Waitlist + Live Instagram Seat Sync
    const createDepRes = await fetch(`${baseUrl}/trips/${createdTripId}/departures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        start_date: '2026-11-20',
        end_date: '2026-11-22',
        price_per_person: 4999,
        token_amount: 1500,
        total_seats: 15,
        offline_blocked_seats: 3,
        min_group_size: 6,
        booking_deadline: '2026-11-18 20:00:00'
      })
    });
    const createDepData = await createDepRes.json();
    assert.equal(createDepRes.status, 201);
    assert.equal(createDepData.data.departure_status, 'OPEN');
    const newDepId = createDepData.data.id;

    const travLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'aarav@example.com', password: 'Password@123' })
    });
    const travToken = (await travLoginRes.json()).data.accessToken;

    await fetch(`${baseUrl}/departures/${newDepId}/interest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        seats_interested: 2,
        interest_type: 'WAIT_FOR_GUARANTEE',
        notes: 'Notify me once minimum group size of 6 is reached!'
      })
    });

    const syncInvRes = await fetch(`${baseUrl}/departures/${newDepId}/inventory`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({ offline_blocked_seats: 6 })
    });
    const syncInvData = await syncInvRes.json();
    assert.equal(syncInvRes.status, 200);
    assert.equal(syncInvData.data.departure_status, 'GUARANTEED');
    assert.equal(syncInvData.data.waitlist_travelers_notified_on_guarantee, 1);
    recordPass('P2.3', 'Instagram Offline Seat Sync & Auto-Guarantee Notification', `Status: ${syncInvData.data.departure_status}, Waitlist Notified: ${syncInvData.data.waitlist_travelers_notified_on_guarantee}`);

    // P2.4 Experience-First Discovery & Side-by-Side Comparison
    const discoverRes = await fetch(`${baseUrl}/trips?origin_city=Indore&only_guaranteed=true`);
    const discoverData = await discoverRes.json();
    assert.equal(discoverRes.status, 200);
    assert.ok(discoverData.data.count >= 2);

    const compareRes = await fetch(`${baseUrl}/trips/compare?ids=1,2,3`);
    const compareData = await compareRes.json();
    assert.equal(compareRes.status, 200);
    assert.equal(compareData.data.compared_count, 3);
    recordPass('P2.4', 'Multi-Filter Discovery & 3-Way Side-by-Side Trip Comparison', `Indore Guaranteed Trips: ${discoverData.data.count}, Compared: ${compareData.data.compared_count}`);

    // ========================================================================
    // PHASE 3: ATOMIC BOOKINGS, SAFETY GUARDS, ENQUIRIES & B2B DASHBOARD
    // ========================================================================
    console.log('\n--- PHASE 3: Atomic Bookings, Road-Trip Safety Guards & B2B Dashboard ---');

    // P3.1 Bike Expedition License Guard
    const noLicenseRes = await fetch(`${baseUrl}/bookings/reserve`, {
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
    assert.equal(noLicenseRes.status, 400);
    recordPass('P3.1', 'Bike Expedition Driving License Safety Guard', 'HTTP 400 Bad Request when driving_license_number is missing');

    // P3.2 Overbooking Guard
    const overbookRes = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: 3, // IND-CAMP-01 only has 4 seats left (20 total - 11 booked - 5 offline)
        payment_plan: 'FULL',
        participants: Array.from({ length: 6 }, (_, i) => ({
          full_name: `Traveler ${i + 1}`,
          age: 25,
          gender: 'MALE',
          phone: '9000000005',
          emergency_contact_name: 'Parent',
          emergency_contact_phone: '9826011122'
        }))
      })
    });
    assert.equal(overbookRes.status, 409);
    recordPass('P3.2', 'Atomic Seat Capacity Overbooking Guard (SELECT ... FOR UPDATE)', 'HTTP 409 Conflict when requesting 6 seats with only 4 available');

    // P3.3 Valid Atomic Reservation + Manual MVP Confirmation + Manifest CSV Export
    const reserve3Res = await fetch(`${baseUrl}/bookings/reserve`, {
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
            id_proof_type: 'DRIVING_LICENSE',
            driving_license_number: 'MP09-20190045123',
            blood_group: 'O+',
            emergency_contact_name: 'Rajesh Verma',
            emergency_contact_phone: '9826011122'
          }
        ]
      })
    });
    const reserve3Data = await reserve3Res.json();
    assert.equal(reserve3Res.status, 201);
    phase3BookingId = reserve3Data.data.booking.id;

    const himalayanOpLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'rohan@himalayannomads.in', password: 'Password@123' })
    });
    const himalayanOpToken = (await himalayanOpLogin.json()).data.accessToken;

    const manualConfirmRes = await fetch(
      `${baseUrl}/bookings/operator/${phase3BookingId}/confirm-manual`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${himalayanOpToken}`
        },
        body: JSON.stringify({
          amount_received: 5000,
          operator_remarks: 'Manual MVP UPI Token Verified'
        })
      }
    );
    assert.equal(manualConfirmRes.status, 200);

    const manifestCsvRes = await fetch(`${baseUrl}/departures/2/manifest?format=csv`, {
      headers: { Authorization: `Bearer ${himalayanOpToken}` }
    });
    const csvContent = await manifestCsvRes.text();
    assert.equal(manifestCsvRes.status, 200);
    assert.ok(csvContent.includes('MP09-20190045123'));
    recordPass('P3.3', 'Atomic Reservation, Manual Confirmation & CSV Manifest Export', `Booking Ref: ${reserve3Data.data.booking.booking_reference}, CSV Verified`);

    // P3.4 Operator B2B Command Center Dashboard & Custom Trip Enquiry Quote
    const dashRes = await fetch(`${baseUrl}/operators/me/dashboard`, {
      headers: { Authorization: `Bearer ${himalayanOpToken}` }
    });
    const dashData = await dashRes.json();
    assert.equal(dashRes.status, 200);

    const enqRes = await fetch(`${baseUrl}/bookings/enquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        trip_id: 4,
        preferred_start_date: '2026-12-20',
        group_size: 6,
        budget_per_person: 18500,
        origin_city: 'Indore',
        customization_notes: 'Private family trip to Udaipur & Jaisalmer',
        contact_phone: '9000000005'
      })
    });
    const enqData = await enqRes.json();
    phase3EnquiryId = enqData.data.id;

    const quoteRes = await fetch(`${baseUrl}/bookings/operator/enquiries/${phase3EnquiryId}/quote`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unverifiedOpToken}`
      },
      body: JSON.stringify({
        status: 'QUOTED',
        operator_quote_total: 108000,
        operator_response_notes: 'Includes Private Innova Crysta & heritage stays.'
      })
    });
    assert.equal(quoteRes.status, 200);
    recordPass('P3.4', 'Operator B2B Dashboard & Custom Private Enquiry Quote Flow', `Occupancy: ${dashData.data.inventory_overview.overall_occupancy_percentage}%, Quote: ₹1,08,000`);

    // ========================================================================
    // PHASE 4: PAYMENTS, POLICY CANCELLATIONS, REFUNDS & ESCROW PAYOUTS
    // ========================================================================
    console.log('\n--- PHASE 4: Online Payments, Policy Refunds & Escrow Payouts ---');

    // Reserve on Departure #5 (Indore -> Pachmarhi, 27 days out -> 100% free cancellation window)
    const reserve4Res = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: 5,
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
    const reserve4Data = await reserve4Res.json();
    phase4BookingId = reserve4Data.data.booking.id;
    const phase4BookingRef = reserve4Data.data.booking.booking_reference;

    // P4.1 Create Order & Tampered HMAC Signature Guard
    const orderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: phase4BookingRef,
        payment_purpose: 'INITIAL_BOOKING'
      })
    });
    const orderData = await orderRes.json();
    assert.equal(orderRes.status, 201);

    const badSigRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        razorpay_order_id: orderData.data.razorpay_order_id,
        razorpay_payment_id: 'pay_tampered_12345',
        razorpay_signature: 'invalid_hmac_signature_string'
      })
    });
    assert.equal(badSigRes.status, 400);
    recordPass('P4.1', 'Payment Order Creation & Tampered HMAC Signature Guard', 'HTTP 400 Bad Request on invalid signature');

    // P4.2 Valid Token Payment + Balance Settlement Capture
    const verifyTokenRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(orderData.data.dev_webhook_simulator)
    });
    const verifyTokenData = await verifyTokenRes.json();
    assert.equal(verifyTokenRes.status, 200);
    assert.equal(verifyTokenData.data.booking.booking_status, 'CONFIRMED');
    assert.equal(verifyTokenData.data.operator_escrow_payout.payout_status, 'ESCROW_HELD');

    const balOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: phase4BookingRef,
        payment_purpose: 'BALANCE_SETTLEMENT'
      })
    });
    const balOrderData = await balOrderRes.json();

    const verifyBalRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(balOrderData.data.dev_webhook_simulator)
    });
    const verifyBalData = await verifyBalRes.json();
    assert.equal(verifyBalRes.status, 200);
    assert.equal(verifyBalData.data.booking.balance_due, 0);
    recordPass('P4.2', 'Token + Balance Payment Capture & Escrow Ledger Upsert', `Total Paid: ₹${verifyBalData.data.booking.amount_paid}, Balance Due: ₹0`);

    // P4.3 Policy-Driven Cancellation Preview & Traveler Cancellation Refund
    const cancelPreviewRes = await fetch(
      `${baseUrl}/bookings/${phase4BookingRef}/cancellation-preview`,
      { headers: { Authorization: `Bearer ${travToken}` } }
    );
    const cancelPreviewData = await cancelPreviewRes.json();
    assert.equal(cancelPreviewRes.status, 200);
    assert.equal(cancelPreviewData.data.refund_calculation.refund_percentage, 100);

    const cancelBookingRes = await fetch(`${baseUrl}/bookings/${phase4BookingRef}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({ reason: 'Testing policy-driven refund engine' })
    });
    const cancelBookingData = await cancelBookingRes.json();
    assert.equal(cancelBookingRes.status, 200);
    assert.equal(cancelBookingData.data.refund.status, 'PROCESSED');
    assert.equal(cancelBookingData.data.refund.refund_amount, 6499);
    recordPass('P4.3', 'Policy-Driven Cancellation Preview & Refund Execution', `Tier: ${cancelBookingData.data.refund.policy_tier_applied}, Refunded: ₹${cancelBookingData.data.refund.refund_amount}`);

    // P4.4 Operator Batch Cancellation Protection (100% Traveler Refund)
    const tempDepRes = await fetch(`${baseUrl}/trips/3/departures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opToken}`
      },
      body: JSON.stringify({
        start_date: '2026-10-12',
        end_date: '2026-10-13',
        price_per_person: 2499,
        token_amount: 999,
        total_seats: 15,
        min_group_size: 8,
        booking_deadline: '2026-10-11 20:00:00'
      })
    });
    phase4TempDepartureId = (await tempDepRes.json()).data.id;

    const tempBookRes = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: phase4TempDepartureId,
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
    const tempBookRef = (await tempBookRes.json()).data.booking.booking_reference;

    const tempOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({ booking_reference: tempBookRef })
    });
    const tempOrderData = await tempOrderRes.json();

    await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(tempOrderData.data.dev_webhook_simulator)
    });

    const batchCancelRes = await fetch(
      `${baseUrl}/departures/${phase4TempDepartureId}/cancel-batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opToken}`
        },
        body: JSON.stringify({ reason: 'Minimum group threshold of 8 not met' })
      }
    );
    const batchCancelData = await batchCancelRes.json();
    assert.equal(batchCancelRes.status, 200);
    assert.equal(batchCancelData.data.total_refund_amount_inr, 2499);
    recordPass('P4.4', 'Operator Batch Cancellation 100% Traveler Refund Protection', `Full Refund Issued: ₹${batchCancelData.data.total_refund_amount_inr}`);

    // ========================================================================
    // PHASE 5: TRUST, SAFETY, VERIFIED REVIEWS & INCIDENT ESCROW FREEZE
    // ========================================================================
    console.log('\n--- PHASE 5: Trust, Safety, Verified Reviews & Incident Escrow Freeze ---');

    // Reserve & Pay on Departure #3 (Indore Camping)
    const reserve5Res = await fetch(`${baseUrl}/bookings/reserve`, {
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
    const reserve5Data = await reserve5Res.json();
    phase5BookingId = reserve5Data.data.booking.id;
    const phase5BookingRef = reserve5Data.data.booking.booking_reference;

    const p5OrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({ booking_reference: phase5BookingRef })
    });
    const p5OrderData = await p5OrderRes.json();

    const p5VerifyRes = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(p5OrderData.data.dev_webhook_simulator)
    });
    const p5VerifyData = await p5VerifyRes.json();
    const p5PayoutId = p5VerifyData.data.operator_escrow_payout.id;

    // P5.1 Report Critical Safety Incident -> Freezes Escrow Payout -> Blocks Admin Settlement
    const incidentRes = await fetch(`${baseUrl}/reviews/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: phase5BookingRef,
        incident_category: 'SUBSTANDARD_ACCOMMODATION',
        severity: 'HIGH',
        description: 'Dome tents had water seepage during evening drizzle; requested replacement.'
      })
    });
    const incidentData = await incidentRes.json();
    assert.equal(incidentRes.status, 201);
    assert.equal(incidentData.data.incident.payout_frozen, 1);
    const incidentId = incidentData.data.incident.id;

    const blockedSettleRes = await fetch(
      `${baseUrl}/payments/admin/payouts/${p5PayoutId}/settle`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ settlement_utr_number: 'UTR-BLOCKED-TEST' })
      }
    );
    assert.equal(blockedSettleRes.status, 409);
    recordPass('P5.1', 'High-Severity Incident Escrow Freeze & Settlement Block', `Incident: ${incidentData.data.incident.incident_reference}, Settlement Blocked (HTTP 409)`);

    // P5.2 Resolve Incident -> Unfreeze Payout -> Settle Payout Successfully
    await fetch(`${baseUrl}/reviews/incidents/${incidentId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'RESOLVED_NO_FAULT',
        admin_resolution_notes: 'Operator upgraded travelers to waterproof cottages immediately.',
        unfreeze_operator_payout: true
      })
    });

    const settleSuccessRes = await fetch(
      `${baseUrl}/payments/admin/payouts/${p5PayoutId}/settle`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          settlement_utr_number: 'UTRHDFC202610109988',
          remarks: 'Settled after incident resolution'
        })
      }
    );
    const settleSuccessData = await settleSuccessRes.json();
    assert.equal(settleSuccessRes.status, 200);
    assert.equal(settleSuccessData.data.payout_status, 'SETTLED');
    recordPass('P5.2', 'Incident Resolution, Escrow Unfreeze & Admin Bank UTR Settlement', `Payout Status: ${settleSuccessData.data.payout_status}, UTR: ${settleSuccessData.data.settlement_utr_number}`);

    // P5.3 Verified Multi-Dimensional Review & Composite Operator Trust Score
    const revRes = await fetch(`${baseUrl}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: phase5BookingRef,
        overall_rating: 5,
        itinerary_accuracy_rating: 5,
        safety_and_captain_rating: 5,
        accommodation_and_food_rating: 5,
        group_vibe_rating: 5,
        review_title: 'Great support & memorable Choral campfire!',
        review_text: 'The team resolved our tent issue immediately and the acoustic night was super fun.'
      })
    });
    assert.equal(revRes.status, 201);

    const trustRes = await fetch(`${baseUrl}/reviews/operator/himalayan-nomads-community`);
    const trustData = await trustRes.json();
    assert.equal(trustRes.status, 200);
    assert.ok(trustData.data.trust_profile.composite_trust_score >= 80);
    recordPass('P5.3', 'Verified Multi-Dimensional Review & Composite Trust Score', `Himalayan Nomads Trust Score: ${trustData.data.trust_profile.composite_trust_score}/100 (${trustData.data.trust_profile.trust_tier})`);

    // ========================================================================
    // PHASE 6: TRAVEL COMPATIBILITY & ANONYMIZED GROUP INSIGHTS (MODEL B)
    // ========================================================================
    console.log('\n--- PHASE 6: Travel Compatibility & Anonymized Group Insights ---');

    // P6.1 Anonymized "Who's In This Group" Batch Preview
    const groupInsightsRes = await fetch(`${baseUrl}/departures/1/group-insights`);
    const groupInsightsData = await groupInsightsRes.json();
    assert.equal(groupInsightsRes.status, 200);
    assert.ok(groupInsightsData.data.privacy_safe_headline.includes('seats filled'));
    recordPass('P6.1', 'Anonymized "Who is in this group" Batch Preview', groupInsightsData.data.privacy_safe_headline);

    // P6.2 Personalized Compatibility Recommendations & 5-Dimension Check
    const recRes = await fetch(`${baseUrl}/compatibility/recommendations`, {
      headers: { Authorization: `Bearer ${travToken}` }
    });
    const recData = await recRes.json();
    assert.equal(recRes.status, 200);
    const bestMatch = recData.data.recommendations[0];
    assert.ok(bestMatch.compatibility_match.match_score_percentage >= 90);
    recordPass('P6.2', '5-Dimension Personalized Compatibility Recommendations', `Top Match: ${bestMatch.title} (${bestMatch.compatibility_match.match_score_percentage}%)`);

    const checkRes = await fetch(`${baseUrl}/compatibility/trips/4/check`, {
      headers: { Authorization: `Bearer ${travToken}` }
    });
    const checkData = await checkRes.json();
    assert.equal(checkRes.status, 200);
    assert.ok(checkData.data.compatibility.things_to_know.length >= 1);
    recordPass('P6.3', 'Contrasting Trip Mismatch Advisory ("Things to Know")', checkData.data.compatibility.things_to_know[0]);

    console.log('\n================================================================================');
    console.log(`🎉 ALL ${results.length} END-TO-END ASSERTIONS ACROSS PHASES 1–6 PASSED SUCCESSFULLY!`);
    console.log('================================================================================\n');
  } finally {
    // Clean up all temporary test records so tour_marketplace_db remains in pristine seeded state
    if (phase3BookingId) {
      await pool.query('DELETE FROM bookings WHERE id = ?', [phase3BookingId]);
    }
    if (phase4BookingId) {
      await pool.query('DELETE FROM bookings WHERE id = ?', [phase4BookingId]);
    }
    if (phase5BookingId) {
      await pool.query('DELETE FROM bookings WHERE id = ?', [phase5BookingId]);
    }
    if (phase3EnquiryId) {
      await pool.query('DELETE FROM custom_trip_enquiries WHERE id = ?', [phase3EnquiryId]);
    }
    if (phase4TempDepartureId) {
      await pool.query('DELETE FROM trip_departures WHERE id = ?', [phase4TempDepartureId]);
    }
    if (createdTripId) {
      await pool.query('DELETE FROM trips WHERE id = ?', [createdTripId]);
    }
    if (tempUserPhone) {
      await pool.query('DELETE FROM users WHERE phone = ?', [tempUserPhone]);
      await pool.query('DELETE FROM otp_verifications WHERE phone = ?', [tempUserPhone]);
    }

    // Restore exact seeded state for departures & operators
    await pool.query(`UPDATE trip_departures SET booked_seats = 3, departure_status = 'OPEN' WHERE id = 2`);
    await pool.query(`UPDATE trip_departures SET booked_seats = 11, departure_status = 'FILLING_FAST' WHERE id = 3`);
    await pool.query(`UPDATE trip_departures SET booked_seats = 5, departure_status = 'GUARANTEED' WHERE id = 5`);
    await pool.query(`UPDATE operators SET rating_avg = 4.70, reviews_count = 62, cancellation_rate_pct = 0.00 WHERE id = 2`);

    server.close();
    await pool.end();
  }
}

runMasterE2ETestSuite();
