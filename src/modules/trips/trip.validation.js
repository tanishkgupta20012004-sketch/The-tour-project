import { z } from 'zod';

const itineraryDaySchema = z.object({
  day_number: z.number().int().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10),
  meals_included: z.string().trim().max(100).optional(),
  accommodation_details: z.string().trim().max(200).optional(),
  travel_distance_km: z.number().int().min(0).optional()
});

const cancellationPolicySchema = z.object({
  free_cancellation_days_before: z.number().int().min(0).default(15),
  refund_7_to_15_days_pct: z.number().min(0).max(100).default(50),
  refund_under_7_days_pct: z.number().min(0).max(100).default(0),
  operator_cancellation_refund_pct: z.number().min(100).max(100).default(100)
});

export const createTripSchema = z.object({
  title: z.string().trim().min(5, 'Trip title must be at least 5 characters').max(200),
  trip_category: z.enum([
    'STRANGER_GROUP',
    'PRIVATE_GROUP',
    'BIKE_CAR_EXPEDITION',
    'WEEKEND_NICHE'
  ]),
  experience_type: z.string().trim().min(3).max(80),
  origin_city: z.string().trim().min(2).max(100),
  destination_city: z.string().trim().min(2).max(100),
  state_or_country: z.string().trim().max(100).optional().default('India'),
  duration_days: z.number().int().min(1).max(60),
  duration_nights: z.number().int().min(0).max(60),
  base_price: z.number().positive('Base price must be greater than 0'),
  comfort_level: z.enum(['BUDGET', 'STANDARD', 'PREMIUM']).optional().default('STANDARD'),
  difficulty_level: z
    .enum(['EASY', 'MODERATE', 'CHALLENGING', 'EXTREME'])
    .optional()
    .default('MODERATE'),
  accommodation_type: z
    .enum(['CAMPING', 'HOSTEL', 'HOTEL', 'BOUTIQUE_STAY', 'MIXED'])
    .optional()
    .default('MIXED'),
  pace_tag: z.enum(['RELAXED', 'BALANCED', 'HIGH_ADVENTURE']).optional().default('BALANCED'),
  vibe_tags: z.array(z.string().trim()).optional().default([]),
  highlights: z.array(z.string().trim()).optional().default([]),
  inclusions: z.array(z.string().trim()).min(1, 'Provide at least one inclusion'),
  exclusions: z.array(z.string().trim()).min(1, 'Provide at least one exclusion'),
  cancellation_policy: cancellationPolicySchema.optional().default({
    free_cancellation_days_before: 15,
    refund_7_to_15_days_pct: 50,
    refund_under_7_days_pct: 0,
    operator_cancellation_refund_pct: 100
  }),
  safety_and_permits: z.record(z.any()).optional().default({}),
  is_customizable_private: z.boolean().optional().default(false),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
  itineraries: z.array(itineraryDaySchema).optional().default([])
});

export const updateTripSchema = createTripSchema.partial();

export const updateTripStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED'])
});
