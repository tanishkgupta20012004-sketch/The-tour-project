import { z } from 'zod';

export const onboardOperatorSchema = z.object({
  business_name: z.string().trim().min(3, 'Business name must be at least 3 characters').max(160),
  tagline: z.string().trim().max(255).optional(),
  bio: z.string().trim().max(3000).optional(),
  operator_type: z
    .enum(['INDIVIDUAL_ORGANIZER', 'TRAVEL_COMMUNITY', 'REGISTERED_AGENCY', 'BIKER_CLUB'])
    .default('TRAVEL_COMMUNITY'),
  base_city: z.string().trim().min(2).max(100),
  operating_regions: z.array(z.string().trim()).min(1, 'Specify at least one operating region'),
  instagram_handle: z.string().trim().max(100).optional(),
  website_url: z.string().trim().url('Invalid website URL').optional().or(z.literal('')),
  support_email: z.string().trim().email('Invalid support email').optional(),
  support_phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit support phone is required'),
  emergency_contact_phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Valid 10-digit emergency contact phone is required'),
  gst_number: z.string().trim().max(25).optional(),
  pan_number: z.string().trim().max(20).optional(),
  kyc_documents: z
    .object({
      registration_proof_url: z.string().url().optional(),
      pan_card_url: z.string().url().optional(),
      insurance_certificate_url: z.string().url().optional()
    })
    .optional()
});

export const updateOperatorProfileSchema = onboardOperatorSchema.partial();

export const verifyOperatorKycSchema = z.object({
  kyc_status: z.enum(['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
  remarks: z.string().trim().max(500).optional(),
  commission_rate_pct: z.number().min(0).max(40).optional()
});
