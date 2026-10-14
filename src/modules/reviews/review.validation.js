import { z } from 'zod';

const ratingField = z.number().int().min(1, 'Rating must be between 1 and 5').max(5);

export const createVerifiedReviewSchema = z.object({
  booking_reference: z.string().trim().min(5, 'Valid booking_reference is required'),
  overall_rating: ratingField,
  itinerary_accuracy_rating: ratingField,
  safety_and_captain_rating: ratingField,
  accommodation_and_food_rating: ratingField,
  group_vibe_rating: ratingField,
  review_title: z.string().trim().min(4).max(160),
  review_text: z.string().trim().min(15, 'Review text must be at least 15 characters').max(3000)
});

export const replyToReviewSchema = z.object({
  operator_public_reply: z.string().trim().min(5).max(2000)
});

export const createIncidentSchema = z.object({
  booking_reference: z.string().trim().min(5, 'Valid booking_reference is required'),
  incident_category: z.enum([
    'SUBSTANDARD_ACCOMMODATION',
    'ITINERARY_MISREPRESENTATION',
    'VEHICLE_OR_SAFETY_HAZARD',
    'HARASSMENT_OR_GROUP_BEHAVIOR',
    'MEDICAL_OR_SOS_EMERGENCY',
    'OPERATOR_UNRESPONSIVE'
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL_SOS']).default('MEDIUM'),
  description: z.string().trim().min(15, 'Provide a clear description of the incident').max(3000),
  evidence_urls: z.array(z.string().url()).optional().default([])
});

export const operatorIncidentExplanationSchema = z.object({
  operator_explanation: z.string().trim().min(10).max(2000)
});

export const resolveIncidentSchema = z.object({
  status: z.enum([
    'INVESTIGATING',
    'RESOLVED_TRAVELER_COMPENSATED',
    'RESOLVED_NO_FAULT',
    'DISMISSED'
  ]),
  admin_resolution_notes: z.string().trim().min(5).max(2000),
  unfreeze_operator_payout: z.boolean().optional().default(true)
});
