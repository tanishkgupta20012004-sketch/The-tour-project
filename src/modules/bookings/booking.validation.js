import { z } from 'zod';

const participantSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  age: z.number().int().min(1).max(100),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER']),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit participant phone is required'),
  id_proof_type: z
    .enum(['AADHAAR', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID'])
    .optional()
    .default('AADHAAR'),
  id_proof_number: z.string().trim().max(50).optional(),
  driving_license_number: z.string().trim().max(50).optional(),
  blood_group: z.string().trim().max(10).optional(),
  medical_conditions: z.string().trim().max(255).optional(),
  emergency_contact_name: z.string().trim().min(2).max(120),
  emergency_contact_phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Valid 10-digit emergency contact phone is required'),
  is_primary_contact: z.boolean().optional().default(false)
});

export const reserveSeatsSchema = z.object({
  departure_id: z.number().int().positive(),
  payment_plan: z.enum(['FULL', 'TOKEN']).optional().default('FULL'),
  special_requests: z.string().trim().max(500).optional(),
  participants: z
    .array(participantSchema)
    .min(1, 'At least one participant is required to reserve seats')
    .max(25, 'Maximum 25 participants per booking')
});

export const createCustomEnquirySchema = z.object({
  trip_id: z.number().int().positive(),
  preferred_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'preferred_start_date must be YYYY-MM-DD'),
  group_size: z.number().int().min(1).max(100),
  budget_per_person: z.number().positive().optional(),
  origin_city: z.string().trim().min(2).max(100),
  customization_notes: z.string().trim().max(1500).optional(),
  contact_phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Valid 10-digit contact phone number is required')
});

export const quoteCustomEnquirySchema = z.object({
  status: z.enum(['QUOTED', 'ACCEPTED', 'CLOSED']),
  operator_quote_total: z.number().positive().optional(),
  operator_response_notes: z.string().trim().max(1500).optional()
});

export const confirmManualBookingSchema = z.object({
  amount_received: z.number().min(0),
  operator_remarks: z.string().trim().max(500).optional()
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(5, 'Please provide a brief cancellation reason').max(500)
});

