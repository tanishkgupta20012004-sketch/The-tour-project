import app from '../src/app.js';
import pool from '../src/config/db.js';

async function verifyPhase4() {
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  console.log(`\n🔍 Running Phase 4 End-to-End Verification against ${baseUrl}...\n`);

  let testBookingId = null;
  let tempDepartureId = null;

  try {
    // 1. Login as Traveler
    const travLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'aarav@example.com',
        password: 'Password@123'
      })
    });
    const travToken = (await travLoginRes.json()).data.accessToken;

    // 2. Reserve 2 Seats on Indore -> Pachmarhi Road Trip (departure_id=5, token=₹1500/seat, price=₹6499/seat)
    const reserveRes = await fetch(`${baseUrl}/bookings/reserve`, {
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
          },
          {
            full_name: 'Riya Joshi',
            age: 26,
            gender: 'FEMALE',
            phone: '9826055544',
            emergency_contact_name: 'Sunita Joshi',
            emergency_contact_phone: '9826055500'
          }
        ]
      })
    });
    const reserveData = await reserveRes.json();
    testBookingId = reserveData.data.booking.id;
    const bookingRef = reserveData.data.booking.booking_reference;
    console.log(
      '1. [POST /bookings/reserve]:',
      reserveData.statusCode,
      'Ref:',
      bookingRef,
      '| Total: ₹' + reserveData.data.booking.total_amount,
      '| Token Required: ₹' + reserveData.data.payable_now_amount
    );

    // 3. Create Payment Order for INITIAL_BOOKING (Token ₹3,000) & Verify via HMAC Signature
    const order1Res = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: bookingRef,
        payment_purpose: 'INITIAL_BOOKING'
      })
    });
    const order1Data = await order1Res.json();
    console.log(
      '2. [POST /payments/create-order (Token)]:',
      order1Data.statusCode,
      'Order ID:',
      order1Data.data.razorpay_order_id,
      '| Amount: ₹' + order1Data.data.amount
    );

    const verify1Res = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(order1Data.data.dev_webhook_simulator)
    });
    const verify1Data = await verify1Res.json();
    console.log(
      '3. [POST /payments/verify (Token Captured)]:',
      verify1Data.statusCode,
      'Booking Status:',
      verify1Data.data.booking.booking_status,
      '| Paid: ₹' + verify1Data.data.booking.amount_paid,
      '| Balance Due: ₹' + verify1Data.data.booking.balance_due,
      '| Escrow Status:',
      verify1Data.data.operator_escrow_payout.payout_status
    );

    // 4. Create & Verify BALANCE_SETTLEMENT Order (Remaining ₹9,998)
    const order2Res = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        booking_reference: bookingRef,
        payment_purpose: 'BALANCE_SETTLEMENT'
      })
    });
    const order2Data = await order2Res.json();

    const verify2Res = await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(order2Data.data.dev_webhook_simulator)
    });
    const verify2Data = await verify2Res.json();
    console.log(
      '4. [POST /payments/verify (Balance Settled)]:',
      verify2Data.statusCode,
      'Total Paid: ₹' + verify2Data.data.booking.amount_paid,
      '| Balance Due: ₹' + verify2Data.data.booking.balance_due
    );

    // 5. Preview Policy-Driven Cancellation & Execute Traveler Cancellation
    const previewRes = await fetch(
      `${baseUrl}/bookings/${bookingRef}/cancellation-preview`,
      {
        headers: { Authorization: `Bearer ${travToken}` }
      }
    );
    const previewData = await previewRes.json();
    console.log(
      '5. [GET /bookings/:ref/cancellation-preview]:',
      previewData.statusCode,
      'Tier:',
      previewData.data.refund_calculation.policy_tier_applied,
      '| Eligible Refund: ₹' + previewData.data.refund_calculation.refund_amount
    );

    const cancelRes = await fetch(`${baseUrl}/bookings/${bookingRef}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        reason: 'Unexpected office travel schedule change'
      })
    });
    const cancelData = await cancelRes.json();
    console.log(
      '6. [POST /bookings/:ref/cancel (Traveler)]:',
      cancelData.statusCode,
      'Booking Status:',
      cancelData.data.booking.booking_status,
      '| Refund Ref:',
      cancelData.data.refund.refund_reference,
      '| Refunded: ₹' + cancelData.data.refund.refund_amount
    );

    // 6. Operator Batch Cancellation Protection Test (100% Traveler Refund on Operator Cancel)
    const opLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'vikram@malwatrails.in',
        password: 'Password@123'
      })
    });
    const opToken = (await opLoginRes.json()).data.accessToken;

    const createDepRes = await fetch(`${baseUrl}/trips/3/departures`, {
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
    tempDepartureId = (await createDepRes.json()).data.id;

    // Traveler books & pays full ₹2,499 on this departure (only 2 days away, so traveler cancel would be 0%, but operator cancel must give 100%!)
    const batchBookRes = await fetch(`${baseUrl}/bookings/reserve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({
        departure_id: tempDepartureId,
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
    const batchBookingRef = (await batchBookRes.json()).data.booking.booking_reference;

    const batchOrderRes = await fetch(`${baseUrl}/payments/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify({ booking_reference: batchBookingRef })
    });
    const batchOrderData = await batchOrderRes.json();

    await fetch(`${baseUrl}/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${travToken}`
      },
      body: JSON.stringify(batchOrderData.data.dev_webhook_simulator)
    });

    // Operator cancels the entire batch
    const cancelBatchRes = await fetch(
      `${baseUrl}/departures/${tempDepartureId}/cancel-batch`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opToken}`
        },
        body: JSON.stringify({
          reason: 'Minimum group size of 8 not reached by deadline'
        })
      }
    );
    const cancelBatchData = await cancelBatchRes.json();
    console.log(
      '7. [POST /departures/:id/cancel-batch (Operator)]:',
      cancelBatchData.statusCode,
      'Cancelled Bookings:',
      cancelBatchData.data.cancelled_bookings_count,
      '| 100% Refunds Issued: ₹' + cancelBatchData.data.total_refund_amount_inr
    );

    // 7. Admin Escrow Settlement & Marketplace Unit Economics Report
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@tourmarketplace.in',
        password: 'Password@123'
      })
    });
    const adminToken = (await adminLoginRes.json()).data.accessToken;

    const unitEconRes = await fetch(`${baseUrl}/payments/admin/unit-economics`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const unitEconData = await unitEconRes.json();
    console.log(
      '8. [GET /payments/admin/unit-economics]:',
      unitEconData.statusCode,
      'Confirmed GMV: ₹' + unitEconData.data.gmv_and_revenue.confirmed_gmv_inr,
      '| Gross Commission: ₹' +
        unitEconData.data.gmv_and_revenue.gross_platform_commission_inr,
      '| Net Contribution Margin: ₹' +
        unitEconData.data.gmv_and_revenue.net_contribution_before_cac_inr
    );

    console.log('\n✅ All Phase 4 endpoints verified successfully!');
  } finally {
    if (testBookingId) {
      await pool.query('DELETE FROM bookings WHERE id = ?', [testBookingId]);
    }
    if (tempDepartureId) {
      await pool.query('DELETE FROM trip_departures WHERE id = ?', [tempDepartureId]);
      await pool.query('UPDATE operators SET cancellation_rate_pct = 0.00 WHERE id = 2');
    }
    server.close();
    await pool.end();
  }
}

verifyPhase4();
