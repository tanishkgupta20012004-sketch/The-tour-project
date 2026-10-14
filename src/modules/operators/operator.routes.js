import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  getMyOperatorProfile,
  getOperatorBySlug,
  getOperatorDashboard,
  getOperatorVerificationLogs,
  listPublicOperators,
  onboardOperator,
  updateMyOperatorProfile,
  verifyOperatorKyc
} from './operator.controller.js';

const router = Router();

// Public routes
router.get('/', listPublicOperators);

// Authenticated operator routes
router.post('/onboard', authenticate, onboardOperator);
router.get('/me/profile', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getMyOperatorProfile);
router.put('/me/profile', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), updateMyOperatorProfile);
router.get('/me/dashboard', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getOperatorDashboard);

// Admin KYC verification routes
router.patch('/:id/verify', authenticate, authorizeRoles('ADMIN'), verifyOperatorKyc);
router.get('/:id/verification-logs', authenticate, authorizeRoles('ADMIN'), getOperatorVerificationLogs);

// Public operator profile by slug (placed after /me/* so it doesn't shadow static routes)
router.get('/:slug', getOperatorBySlug);

export default router;
