import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { computeRazorpaySignature } from './payment.utils.js';
import {
  createPaymentOrderSchema,
  settleOperatorPayoutSchema,
  verifyPaymentSchema
} from './payment.validation.js';

export const createPaymentOrder = asyncHandler(async (req, res) => {
  const { booking_reference, payment_purpose } = createPaymentOrderSchema.parse(req.body);

  const [bookingRows] = await pool.query(
    'SELECT * FROM bookings WHERE booking_reference = ? LIMIT 1',
    [booking_reference]
  );

  if (!bookingRows.length) {
    throw new ApiError(404, 'Booking not found.');
  }

  const booking = bookingRows[0];
  if (req.user.role !== 'ADMIN' && booking.user_id !== req.user.id) {
    throw new ApiError(403, 'You can only initiate payment for your own booking.');
  }

  if (['CANCELLED_BY_USER', 'CANCELLED_BY_OPERATOR', 'EXPIRED'].includes(booking.booking_status)) {
    throw new ApiError(400, `Cannot initiate payment for a ${booking.booking_status} booking.`);
  }

  if (Number(booking.balance_due) <= 0) {
    throw new ApiError(400, 'This booking is already paid in full.');
  }

  let amountToCharge = Number(booking.balance_due);
  if (
    payment_purpose === 'INITIAL_BOOKING' &&
    booking.payment_plan === 'TOKEN' &&
    Number(booking.amount_paid) === 0
  ) {
    amountToCharge = Number(booking.token_amount_required);
  }

  const gatewayOrderId = `order_Rzp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

  const [insertRes] = await pool.query(
    `INSERT INTO payments (
       booking_id, user_id, payment_purpose, gateway_provider,
       gateway_order_id, amount, currency, status
     ) VALUES (?, ?, ?, 'RAZORPAY', ?, ?, 'INR', 'CREATED')`,
    [booking.id, booking.user_id, payment_purpose, gatewayOrderId, amountToCharge]
  );

  const simulatedPaymentId = `pay_Rzp_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  const simulatedSignature = computeRazorpaySignature(gatewayOrderId, simulatedPaymentId);

  return res.status(201).json(
    new ApiResponse(201, 'Payment order created successfully', {
      payment_id: insertRes.insertId,
      booking_reference: booking.booking_reference,
      payment_purpose,
      razorpay_order_id: gatewayOrderId,
      amount: amountToCharge,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_tour_marketplace',
      ...(process.env.NODE_ENV !== 'production' && {
        dev_webhook_simulator: {
          razorpay_order_id: gatewayOrderId,
          razorpay_payment_id: simulatedPaymentId,
          razorpay_signature: simulatedSignature
        }
      })
    })
  );
});

export const verifyPaymentAndCapture = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(
    req.body
  );

  const expectedSignature = computeRazorpaySignature(razorpay_order_id, razorpay_payment_id);
  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, 'Invalid payment signature. Payment verification failed.');
  }

  const connection = await pool.getConnection();
  let updatedBooking;
  let capturedPayment;
  let payoutRecord;

  try {
    await connection.beginTransaction();

    const [paymentRows] = await connection.query(
      'SELECT * FROM payments WHERE gateway_order_id = ? FOR UPDATE',
      [razorpay_order_id]
    );

    if (!paymentRows.length) {
      throw new ApiError(404, 'Payment order not found.');
    }

    const payment = paymentRows[0];
    if (payment.status === 'CAPTURED') {
      throw new ApiError(409, 'This payment order has already been captured.');
    }

    const [bookingRows] = await connection.query(
      'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
      [payment.booking_id]
    );
    const booking = bookingRows[0];

    // Estimated 2% gateway processing fee
    const gatewayFee = Number((Number(payment.amount) * 0.02).toFixed(2));

    await connection.query(
      `UPDATE payments
       SET gateway_payment_id = ?,
           gateway_signature = ?,
           gateway_fee_amount = ?,
           status = 'CAPTURED',
           paid_at = NOW()
       WHERE id = ?`,
      [razorpay_payment_id, razorpay_signature, gatewayFee, payment.id]
    );

    const newAmountPaid = Math.min(
      Number(booking.total_amount),
      Number((Number(booking.amount_paid) + Number(payment.amount)).toFixed(2))
    );
    const newBalanceDue = Math.max(
      0,
      Number((Number(booking.total_amount) - newAmountPaid).toFixed(2))
    );

    await connection.query(
      `UPDATE bookings
       SET amount_paid = ?,
           balance_due = ?,
           booking_status = 'CONFIRMED',
           hold_expires_at = NULL
       WHERE id = ?`,
      [newAmountPaid, newBalanceDue, booking.id]
    );

    // Calculate cumulative gateway fees for this booking
    const [[feeSumRow]] = await connection.query(
      `SELECT COALESCE(SUM(gateway_fee_amount), 0) AS total_gateway_fee
       FROM payments
       WHERE booking_id = ? AND status = 'CAPTURED'`,
      [booking.id]
    );
    const totalGatewayFee = Number(feeSumRow.total_gateway_fee);

    // Upsert Operator Escrow Payout Record
    const payoutRef = `PO-${booking.booking_reference.replace('BK-', '')}`;
    const netOperatorPayable = Number(
      (Number(booking.total_amount) - Number(booking.platform_commission_amount)).toFixed(2)
    );

    await connection.query(
      `INSERT INTO operator_payouts (
         payout_reference, booking_id, departure_id, operator_id,
         gross_booking_amount, amount_collected,
         platform_commission_pct, platform_commission_amount,
         gateway_fee_amount, net_operator_payable, payout_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ESCROW_HELD')
       ON DUPLICATE KEY UPDATE
         amount_collected = VALUES(amount_collected),
         gateway_fee_amount = VALUES(gateway_fee_amount),
         net_operator_payable = VALUES(net_operator_payable)`,
      [
        payoutRef,
        booking.id,
        booking.departure_id,
        booking.operator_id,
        booking.total_amount,
        newAmountPaid,
        booking.commission_rate_pct,
        booking.platform_commission_amount,
        totalGatewayFee,
        netOperatorPayable
      ]
    );

    await connection.commit();

    const [updatedBookingRows] = await pool.query('SELECT * FROM bookings WHERE id = ? LIMIT 1', [
      booking.id
    ]);
    const [updatedPaymentRows] = await pool.query('SELECT * FROM payments WHERE id = ? LIMIT 1', [
      payment.id
    ]);
    const [payoutRows] = await pool.query(
      'SELECT * FROM operator_payouts WHERE booking_id = ? LIMIT 1',
      [booking.id]
    );

    updatedBooking = updatedBookingRows[0];
    capturedPayment = updatedPaymentRows[0];
    payoutRecord = payoutRows[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return res.status(200).json(
    new ApiResponse(200, 'Payment verified, booking confirmed & escrow ledger updated', {
      payment: capturedPayment,
      booking: updatedBooking,
      operator_escrow_payout: payoutRecord
    })
  );
});

export const getMyPaymentsAndRefunds = asyncHandler(async (req, res) => {
  const [payments] = await pool.query(
    `SELECT p.*, b.booking_reference
     FROM payments p
     JOIN bookings b ON b.id = p.booking_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );

  const [refunds] = await pool.query(
    `SELECT r.*, b.booking_reference
     FROM refunds r
     JOIN bookings b ON b.id = r.booking_id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [req.user.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Traveler payments & refunds fetched', {
      payments,
      refunds
    })
  );
});

export const getOperatorPayoutLedger = asyncHandler(async (req, res) => {
  const [opRows] = await pool.query('SELECT id FROM operators WHERE user_id = ? LIMIT 1', [
    req.user.id
  ]);

  if (!opRows.length && req.user.role !== 'ADMIN') {
    throw new ApiError(404, 'Operator profile not found.');
  }

  const operatorFilter = req.user.role === 'ADMIN' ? '' : 'WHERE op.operator_id = ?';
  const params = req.user.role === 'ADMIN' ? [] : [opRows[0].id];

  const [payouts] = await pool.query(
    `SELECT
       op.*,
       b.booking_reference, b.booking_status,
       td.batch_code, td.start_date, td.end_date,
       t.title AS trip_title
     FROM operator_payouts op
     JOIN bookings b ON b.id = op.booking_id
     JOIN trip_departures td ON td.id = op.departure_id
     JOIN trips t ON t.id = b.trip_id
     ${operatorFilter}
     ORDER BY op.created_at DESC`,
    params
  );

  const summary = payouts.reduce(
    (acc, item) => {
      if (item.payout_status === 'ESCROW_HELD') {
        acc.escrow_held_amount += Number(item.net_operator_payable);
      } else if (item.payout_status === 'SETTLED') {
        acc.settled_amount += Number(item.net_operator_payable);
      }
      return acc;
    },
    { escrow_held_amount: 0, settled_amount: 0 }
  );

  return res.status(200).json(
    new ApiResponse(200, 'Operator escrow & payout ledger fetched', {
      summary: {
        escrow_held_amount: Number(summary.escrow_held_amount.toFixed(2)),
        settled_amount: Number(summary.settled_amount.toFixed(2))
      },
      count: payouts.length,
      payouts
    })
  );
});

export const settleOperatorPayout = asyncHandler(async (req, res) => {
  const payoutId = Number(req.params.id);
  const { settlement_utr_number, remarks } = settleOperatorPayoutSchema.parse(req.body);

  const [rows] = await pool.query('SELECT * FROM operator_payouts WHERE id = ? LIMIT 1', [
    payoutId
  ]);

  if (!rows.length) {
    throw new ApiError(404, 'Operator payout record not found.');
  }

  if (rows[0].payout_status === 'CANCELLED_FORFEITED') {
    throw new ApiError(400, 'Cannot settle a forfeited payout from a cancelled booking.');
  }

  // Enforce Phase 5 Trust & Safety Escrow Freeze if an active HIGH/CRITICAL incident exists
  const [frozenIncidents] = await pool.query(
    `SELECT incident_reference, severity
     FROM trip_incidents
     WHERE booking_id = ? AND payout_frozen = TRUE AND status IN ('OPEN', 'INVESTIGATING')
     LIMIT 1`,
    [rows[0].booking_id]
  );

  if (frozenIncidents.length) {
    throw new ApiError(
      409,
      `Escrow payout is frozen due to active ${frozenIncidents[0].severity} incident (${frozenIncidents[0].incident_reference}). Resolve the incident before settling payout.`
    );
  }

  await pool.query(
    `UPDATE operator_payouts
     SET payout_status = 'SETTLED',
         settlement_utr_number = ?,
         settled_by_admin_id = ?,
         settled_at = NOW(),
         remarks = COALESCE(?, remarks)
     WHERE id = ?`,
    [settlement_utr_number, req.user.id, remarks || null, payoutId]
  );

  const [updated] = await pool.query('SELECT * FROM operator_payouts WHERE id = ? LIMIT 1', [
    payoutId
  ]);

  return res.status(200).json(
    new ApiResponse(200, 'Operator escrow payout settled successfully', updated[0])
  );
});

export const getMarketplaceUnitEconomics = asyncHandler(async (_req, res) => {
  const [[bookingMetrics]] = await pool.query(
    `SELECT
       COUNT(id) AS total_bookings_count,
       SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN 1 ELSE 0 END) AS active_confirmed_bookings,
       SUM(CASE WHEN booking_status IN ('CANCELLED_BY_USER', 'CANCELLED_BY_OPERATOR') THEN 1 ELSE 0 END) AS cancelled_bookings,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN total_amount ELSE 0 END), 0) AS confirmed_gmv,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN amount_paid ELSE 0 END), 0) AS total_cash_collected,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN platform_commission_amount ELSE 0 END), 0) AS gross_commission_revenue,
       COALESCE(SUM(CASE WHEN booking_status IN ('CONFIRMED', 'COMPLETED') THEN operator_payout_amount ELSE 0 END), 0) AS net_operator_payout_liability
     FROM bookings`
  );

  const [[paymentMetrics]] = await pool.query(
    `SELECT COALESCE(SUM(gateway_fee_amount), 0) AS total_gateway_fees
     FROM payments
     WHERE status = 'CAPTURED'`
  );

  const [[refundMetrics]] = await pool.query(
    `SELECT
       COUNT(id) AS total_refund_requests,
       COALESCE(SUM(refund_amount), 0) AS total_refund_amount_issued
     FROM refunds`
  );

  const activeBookings = Number(bookingMetrics.active_confirmed_bookings || 0);
  const confirmedGmv = Number(bookingMetrics.confirmed_gmv || 0);
  const grossCommission = Number(bookingMetrics.gross_commission_revenue || 0);
  const gatewayFees = Number(paymentMetrics.total_gateway_fees || 0);
  const netContributionBeforeMarketing = Number((grossCommission - gatewayFees).toFixed(2));

  return res.status(200).json(
    new ApiResponse(200, 'Marketplace unit economics & contribution margin report', {
      bookings_overview: {
        total_bookings: Number(bookingMetrics.total_bookings_count),
        active_confirmed_bookings: activeBookings,
        cancelled_bookings: Number(bookingMetrics.cancelled_bookings || 0)
      },
      gmv_and_revenue: {
        confirmed_gmv_inr: confirmedGmv,
        total_cash_collected_inr: Number(bookingMetrics.total_cash_collected),
        gross_platform_commission_inr: grossCommission,
        payment_gateway_fees_inr: gatewayFees,
        net_contribution_before_cac_inr: netContributionBeforeMarketing,
        net_operator_payout_liability_inr: Number(bookingMetrics.net_operator_payout_liability)
      },
      per_booking_unit_economics: {
        avg_booking_value_inr:
          activeBookings > 0 ? Number((confirmedGmv / activeBookings).toFixed(2)) : 0,
        avg_commission_per_booking_inr:
          activeBookings > 0 ? Number((grossCommission / activeBookings).toFixed(2)) : 0,
        avg_contribution_per_booking_inr:
          activeBookings > 0
            ? Number((netContributionBeforeMarketing / activeBookings).toFixed(2))
            : 0
      },
      refunds_summary: {
        total_refund_records: Number(refundMetrics.total_refund_requests),
        total_refund_amount_inr: Number(refundMetrics.total_refund_amount_issued)
      }
    })
  );
});
