import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  createPaymentOrder,
  getMarketplaceUnitEconomics,
  getMyPaymentsAndRefunds,
  getOperatorPayoutLedger,
  settleOperatorPayout,
  verifyPaymentAndCapture
} from './payment.controller.js';

const router = Router();

// Traveler payment order creation, verification & transaction history
router.post('/create-order', authenticate, createPaymentOrder);
router.post('/verify', authenticate, verifyPaymentAndCapture);
router.get('/my-transactions', authenticate, getMyPaymentsAndRefunds);

// Operator escrow & payout ledger
router.get('/operator/payouts', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getOperatorPayoutLedger);

// Admin payout settlement & marketplace unit economics
router.patch('/admin/payouts/:id/settle', authenticate, authorizeRoles('ADMIN'), settleOperatorPayout);
router.get('/admin/unit-economics', authenticate, authorizeRoles('ADMIN'), getMarketplaceUnitEconomics);

export default router;
