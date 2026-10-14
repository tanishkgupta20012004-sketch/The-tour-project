import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  cancelBookingByTraveler,
  confirmManualBooking,
  createCustomEnquiry,
  getBookingByReference,
  getMyBookings,
  getMyEnquiries,
  getOperatorBookings,
  getOperatorEnquiries,
  previewBookingCancellation,
  reserveSeats,
  respondToCustomEnquiry
} from './booking.controller.js';

const router = Router();

// Traveler booking & custom enquiry endpoints
router.post('/reserve', authenticate, reserveSeats);
router.get('/my-bookings', authenticate, getMyBookings);
router.post('/enquiry', authenticate, createCustomEnquiry);
router.get('/my-enquiries', authenticate, getMyEnquiries);

// Operator B2B booking & enquiry management endpoints (placed before /:reference)
router.get('/operator/list', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getOperatorBookings);
router.patch(
  '/operator/:id/confirm-manual',
  authenticate,
  authorizeRoles('OPERATOR', 'ADMIN'),
  confirmManualBooking
);
router.get(
  '/operator/enquiries',
  authenticate,
  authorizeRoles('OPERATOR', 'ADMIN'),
  getOperatorEnquiries
);
router.patch(
  '/operator/enquiries/:id/quote',
  authenticate,
  authorizeRoles('OPERATOR', 'ADMIN'),
  respondToCustomEnquiry
);

// Policy-driven cancellation preview & execution
router.get('/:reference/cancellation-preview', authenticate, previewBookingCancellation);
router.post('/:reference/cancel', authenticate, cancelBookingByTraveler);

// Fetch single booking by reference (Traveler, Operator, or Admin)
router.get('/:reference', authenticate, getBookingByReference);

export default router;
