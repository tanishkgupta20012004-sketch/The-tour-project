import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  purpose: z.enum(['LOGIN', 'REGISTER', 'RESET_PASSWORD']).optional().default('LOGIN')
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  otp_code: z.string().trim().length(6, 'OTP must be 6 digits'),
  full_name: z.string().trim().min(2).max(120).optional()
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().email('Invalid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['TRAVELER', 'OPERATOR']).optional().default('TRAVELER')
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your registered phone number or email'),
  password: z.string().min(1, 'Password is required')
});

export const travelerPreferencesSchema = z.object({
  pace_preference: z.enum(['RELAXED', 'BALANCED', 'HIGH_ADVENTURE']).optional(),
  morning_style: z.enum(['EARLY_BIRD', 'FLEXIBLE', 'LEISURELY']).optional(),
  social_style: z.enum(['QUIET_EXPLORATION', 'BALANCED_SOCIAL', 'HIGH_ENERGY_GROUP']).optional(),
  comfort_preference: z.enum(['BUDGET_BACKPACKER', 'STANDARD_COMFORT', 'PREMIUM_BOUTIQUE']).optional(),
  preferred_trip_types: z
    .array(z.enum(['STRANGER_GROUP', 'PRIVATE_GROUP', 'BIKE_CAR_EXPEDITION', 'WEEKEND_NICHE']))
    .optional(),
  age_bracket: z.enum(['18_24', '25_30', '31_40', '40_PLUS']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY']).optional(),
  home_city: z.string().trim().max(100).optional()
});
