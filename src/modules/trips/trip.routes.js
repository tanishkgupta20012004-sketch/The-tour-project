import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { createDeparture } from '../departures/departure.controller.js';
import {
  compareTrips,
  createTrip,
  discoverTrips,
  getMyOperatorTrips,
  getTripBySlug,
  updateTrip,
  updateTripStatus
} from './trip.controller.js';

const router = Router();

// Public discovery & side-by-side comparison routes
router.get('/', discoverTrips);
router.get('/compare', compareTrips);

// Authenticated operator routes (placed before /:slug so static paths aren't shadowed)
router.get('/operator/my-trips', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getMyOperatorTrips);
router.post('/', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), createTrip);
router.put('/:id', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), updateTrip);
router.patch('/:id/status', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), updateTripStatus);

// Operator creates a new departure batch for a trip
router.post('/:tripId/departures', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), createDeparture);

// Public trip detail by slug
router.get('/:slug', getTripBySlug);

export default router;
