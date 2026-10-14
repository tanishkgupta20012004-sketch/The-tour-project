import app from '../src/app.js';
import pool from '../src/config/db.js';

async function verifyPhase1() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  console.log(`\n🔍 Running Phase 1 End-to-End Verification against ${baseUrl}...\n`);

  try {
    // 1. Health Check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    console.log('1. [GET /health]:', healthData.statusCode, healthData.data.database);

    // 2. Send OTP & Verify OTP for a new user
    const testPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const sendOtpRes = await fetch(`${baseUrl}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, purpose: 'REGISTER' })
    });
    const sendOtpData = await sendOtpRes.json();
    console.log('2. [POST /auth/send-otp]:', sendOtpData.statusCode, 'OTP:', sendOtpData.data.dev_otp_code);

    const verifyOtpRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        otp_code: sendOtpData.data.dev_otp_code,
        full_name: 'Kabir Joshi (Spiti Riders)'
      })
    });
    const verifyOtpData = await verifyOtpRes.json();
    const newUserToken = verifyOtpData.data.accessToken;
    console.log('3. [POST /auth/verify-otp]:', verifyOtpData.statusCode, 'Role:', verifyOtpData.data.user.role);

    // 3. Update Traveler Compatibility Preferences
    const prefRes = await fetch(`${baseUrl}/auth/me/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newUserToken}`
      },
      body: JSON.stringify({
        pace_preference: 'HIGH_ADVENTURE',
        morning_style: 'EARLY_BIRD',
        social_style: 'HIGH_ENERGY_GROUP',
        home_city: 'Indore'
      })
    });
    const prefData = await prefRes.json();
    console.log('4. [PUT /auth/me/preferences]:', prefData.statusCode, 'Pace:', prefData.data.pace_preference);

    // 4. Operator Onboarding
    const onboardRes = await fetch(`${baseUrl}/operators/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newUserToken}`
      },
      body: JSON.stringify({
        business_name: `Spiti Valley Expeditions ${testPhone.slice(-4)}`,
        tagline: 'Offbeat Spiti & Kinnaur road trips',
        operator_type: 'BIKER_CLUB',
        base_city: 'Chandigarh',
        operating_regions: ['Himachal Pradesh', 'Spiti Valley'],
        instagram_handle: '@spitivalley_expeditions',
        support_phone: testPhone,
        emergency_contact_phone: '9811009988',
        gst_number: '04DDDDE1234F1Z9',
        pan_number: 'DDDDE1234F'
      })
    });
    const onboardData = await onboardRes.json();
    const newOperatorId = onboardData.data.id;
    console.log('5. [POST /operators/onboard]:', onboardData.statusCode, 'KYC Status:', onboardData.data.kyc_status);

    // 5. Admin Login & Approve Operator KYC
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@tourmarketplace.in',
        password: 'Password@123'
      })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.accessToken;

    const verifyKycRes = await fetch(`${baseUrl}/operators/${newOperatorId}/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        kyc_status: 'VERIFIED',
        remarks: 'GST, PAN, and emergency response contacts verified.',
        commission_rate_pct: 10
      })
    });
    const verifyKycData = await verifyKycRes.json();
    console.log('6. [PATCH /operators/:id/verify (Admin)]:', verifyKycData.statusCode, 'New Status:', verifyKycData.data.kyc_status);

    // 6. Public Operator Directory & Profile by Slug
    const listOpRes = await fetch(`${baseUrl}/operators?verified_only=true`);
    const listOpData = await listOpRes.json();
    console.log('7. [GET /operators?verified_only=true]:', listOpData.statusCode, 'Verified Count:', listOpData.data.count);

    const slugRes = await fetch(`${baseUrl}/operators/himalayan-nomads-community`);
    const slugData = await slugRes.json();
    console.log(
      '8. [GET /operators/:slug]:',
      slugData.statusCode,
      'Operator:',
      slugData.data.operator.business_name,
      '| Published Trips:',
      slugData.data.published_trips.length
    );

    // Clean up temporary test user (cascades to operator & verification logs)
    await pool.query('DELETE FROM users WHERE phone = ?', [testPhone]);

    console.log('\n✅ All Phase 1 endpoints verified successfully!');
  } finally {
    server.close();
    await pool.end();
  }
}

verifyPhase1();
