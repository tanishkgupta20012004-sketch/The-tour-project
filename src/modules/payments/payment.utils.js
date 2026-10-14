import crypto from 'crypto';

export function getRazorpaySecret() {
  return process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_tour_marketplace_2026';
}

export function computeRazorpaySignature(orderId, paymentId) {
  const secret = getRazorpaySecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function calculateCancellationRefund({
  amountPaid,
  startDate,
  cancellationPolicy,
  isOperatorCancelled = false
}) {
  const paid = Number(amountPaid || 0);
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = start.getTime() - now.getTime();
  const daysBeforeDeparture = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const policy =
    typeof cancellationPolicy === 'string'
      ? JSON.parse(cancellationPolicy)
      : cancellationPolicy || {};

  const freeDays = Number(policy.free_cancellation_days_before ?? 15);
  const midTierPct = Number(policy.refund_7_to_15_days_pct ?? 50);
  const lateTierPct = Number(policy.refund_under_7_days_pct ?? 0);
  const operatorCancelPct = Number(policy.operator_cancellation_refund_pct ?? 100);

  let refundPercentage = 0;
  let policyTierApplied = '';

  if (isOperatorCancelled) {
    refundPercentage = operatorCancelPct;
    policyTierApplied = `OPERATOR_BATCH_CANCELLATION (${refundPercentage}%)`;
  } else if (daysBeforeDeparture >= freeDays) {
    refundPercentage = 100;
    policyTierApplied = `FREE_CANCELLATION_OVER_${freeDays}_DAYS (100%)`;
  } else if (daysBeforeDeparture >= 7) {
    refundPercentage = midTierPct;
    policyTierApplied = `7_TO_${freeDays}_DAYS_BEFORE_DEPARTURE (${refundPercentage}%)`;
  } else {
    refundPercentage = lateTierPct;
    policyTierApplied = `UNDER_7_DAYS_BEFORE_DEPARTURE (${refundPercentage}%)`;
  }

  const refundAmount = Number(((paid * refundPercentage) / 100).toFixed(2));
  const nonRefundableRetained = Number((paid - refundAmount).toFixed(2));

  return {
    days_before_departure: daysBeforeDeparture,
    policy_tier_applied: policyTierApplied,
    amount_paid_snapshot: paid,
    refund_percentage: refundPercentage,
    refund_amount: refundAmount,
    non_refundable_retained: nonRefundableRetained
  };
}
