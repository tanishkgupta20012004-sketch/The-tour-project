import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  booking_reference: z.string().trim().min(5),
  payment_purpose: z
    .enum(['INITIAL_BOOKING', 'BALANCE_SETTLEMENT'])
    .optional()
    .default('INITIAL_BOOKING')
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(5),
  razorpay_payment_id: z.string().trim().min(5),
  razorpay_signature: z.string().trim().min(10)
});

export const settleOperatorPayoutSchema = z.object({
  settlement_utr_number: z.string().trim().min(5, 'Provide a valid bank UTR / settlement reference'),
  remarks: z.string().trim().max(500).optional()
});
