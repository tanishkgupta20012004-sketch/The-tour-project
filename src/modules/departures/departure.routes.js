import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { getDepartureGroupInsights } from '../compatibility/compatibility.controller.js';
import {
  cancelDepartureBatch,
  getDepartureById,
  getDepartureInterestList,
  getDepartureManifest,
  registerDepartureInterest,
  syncDepartureInventory
} from './departure.controller.js';

const router = Router();

// Public departure details + confidence metrics
router.get('/:id', getDepartureById);

// Public anonymized "Who's In This Group" batch preview (Phase 6 - Model B)
router.get('/:id/group-insights', getDepartureGroupInsights);

// Operator live inventory & Instagram offline seat sync (Solves Problem 3)
router.patch('/:id/inventory', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), syncDepartureInventory);

// Operator participant manifest & CSV export (Modification 3)
router.get('/:id/manifest', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getDepartureManifest);

// Operator / Admin cancels an entire departure batch with 100% traveler refund protection (Problem 4)
router.post('/:id/cancel-batch', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), cancelDepartureBatch);

// Traveler registers interest / waitlist in a departure (Modification 5)
router.post('/:id/interest', authenticate, registerDepartureInterest);

// Operator views interested travelers watching a departure
router.get('/:id/interest', authenticate, authorizeRoles('OPERATOR', 'ADMIN'), getDepartureInterestList);

export default router;
