import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  createVerifiedReview,
  getMyIncidents,
  getOperatorIncidents,
  getOperatorReviewsAndTrust,
  getTripReviews,
  replyToReview,
  reportTripIncident,
  resolveIncidentByAdmin,
  submitOperatorIncidentExplanation
} from './review.controller.js';

const router = Router();

// Public verified reviews & operator composite trust profile
router.get('/trip/:tripId', getTripReviews);
router.get('/operator/:operatorSlug', getOperatorReviewsAndTrust);

// Traveler submits verified review (strictly requires CONFIRMED/COMPLETED booking)
router.post('/', authenticate, createVerifiedReview);

// Operator posts public reply to a review
router.post('/:id/reply', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), replyToReview);

// Active Trip Safety, SOS & Quality Incident Reporting (Problem 2)
router.post('/incidents', authenticate, reportTripIncident);
router.get('/incidents/my-reports', authenticate, getMyIncidents);
router.get('/incidents/operator', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getOperatorIncidents);
router.patch(
  '/incidents/:id/operator-response',
  authenticate,
  authorizeRoles('OPERATOR', 'ADMIN'),
  submitOperatorIncidentExplanation
);
router.patch(
  '/incidents/:id/resolve',
  authenticate,
  authorizeRoles('ADMIN'),
  resolveIncidentByAdmin
);

export default router;
