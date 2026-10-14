import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required. Please provide a valid Bearer token.');
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'tour_marketplace_access_secret_key_2026'
    );
  } catch (_err) {
    throw new ApiError(401, 'Invalid or expired access token.');
  }

  const [rows] = await pool.query(
    'SELECT id, full_name, email, phone, role, is_phone_verified, is_active FROM users WHERE id = ? LIMIT 1',
    [decoded.id]
  );

  if (!rows.length) {
    throw new ApiError(401, 'User account associated with this token no longer exists.');
  }

  if (!rows[0].is_active) {
    throw new ApiError(403, 'Your account has been deactivated. Please contact support.');
  }

  req.user = rows[0];
  next();
});

export const authorizeRoles = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`
        )
      );
    }
    next();
  };
};
