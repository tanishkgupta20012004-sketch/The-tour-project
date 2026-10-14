import { z } from 'zod';

export const upsertTripCompatibilityProfileSchema = z.object({
  ideal_morning_style: z.enum(['EARLY_BIRD', 'FLEXIBLE', 'LEISURELY']).default('FLEXIBLE'),
  ideal_social_style: z
    .enum(['QUIET_EXPLORATION', 'BALANCED_SOCIAL', 'HIGH_ENERGY_GROUP'])
    .default('BALANCED_SOCIAL'),
  solo_traveler_friendly: z.boolean().default(true),
  ideal_age_brackets: z
    .array(z.enum(['18_24', '25_30', '31_40', '40_PLUS']))
    .optional()
    .default(['18_24', '25_30', '31_40']),
  activity_intensity_level: z.number().int().min(1).max(5).default(3),
  group_vibe_summary: z.string().trim().min(10).max(255)
});
