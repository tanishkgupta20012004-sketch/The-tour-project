import { z } from 'zod';

export const createDepartureSchema = z.object({
  batch_code: z.string().trim().min(3).max(50).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
  price_per_person: z.number().positive('price_per_person must be greater than 0'),
  token_amount: z.number().min(0).optional().default(0),
  total_seats: z.number().int().min(1).max(200),
  offline_blocked_seats: z.number().int().min(0).optional().default(0),
  min_group_size: z.number().int().min(1).max(200).optional().default(6),
  booking_deadline: z.string().trim().min(10, 'Provide booking_deadline as YYYY-MM-DD HH:mm:ss or ISO date')
});

export const syncInventorySchema = z.object({
  offline_blocked_seats: z.number().int().min(0).optional(),
  total_seats: z.number().int().min(1).max(200).optional(),
  min_group_size: z.number().int().min(1).max(200).optional(),
  price_per_person: z.number().positive().optional(),
  token_amount: z.number().min(0).optional(),
  booking_deadline: z.string().trim().optional()
});

export const registerInterestSchema = z.object({
  seats_interested: z.number().int().min(1).max(20).optional().default(1),
  interest_type: z
    .enum(['WAIT_FOR_GUARANTEE', 'WAIT_FOR_SEAT_OPENING', 'PRICE_DROP_ALERT'])
    .optional()
    .default('WAIT_FOR_GUARANTEE'),
  notes: z.string().trim().max(300).optional()
});

export const cancelDepartureBatchSchema = z.object({
  reason: z.string().trim().min(5, 'Provide a reason for batch cancellation').max(500)
});

