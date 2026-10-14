import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  checkTripCompatibilityForUser,
  getDepartureGroupInsights,
  getPersonalizedTripRecommendations,
  upsertTripCompatibilityProfile
} from './compatibility.controller.js';

const router = Router();

// Public anonymized "Who's In This Group" batch insights
router.get('/departures/:departureId/group-insights', getDepartureGroupInsights);

// Authenticated traveler compatibility matching & recommendations
router.get('/recommendations', authenticate, getPersonalizedTripRecommendations);
router.get('/trips/:tripId/check', authenticate, checkTripCompatibilityForUser);

// Operator configures trip compatibility & group vibe profile
router.put(
  '/trips/:tripId/profile',
  authenticate,
  authorizeRoles('OPERATOR', 'ADMIN'),
  upsertTripCompatibilityProfile
);

export default router;
