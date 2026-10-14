import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import {
  getMe,
  login,
  register,
  sendOtp,
  updateTravelerPreferences,
  verifyOtp
} from './auth.controller.js';

const router = Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);
router.post('/login', login);

router.get('/me', authenticate, getMe);
router.put('/me/preferences', authenticate, updateTravelerPreferences);

export default router;
