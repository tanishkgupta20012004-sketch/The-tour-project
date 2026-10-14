import bcrypt from 'bcryptjs';
import pool from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { generateTokens } from '../../utils/jwt.js';
import {
  loginSchema,
  registerSchema,
  sendOtpSchema,
  travelerPreferencesSchema,
  verifyOtpSchema
} from './auth.validation.js';

export const sendOtp = asyncHandler(async (req, res) => {
  const { phone, purpose } = sendOtpSchema.parse(req.body);

  // Generate 6-digit OTP
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);

  await pool.query(
    `INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [phone, otpCode, purpose, expiryMinutes]
  );

  return res.status(200).json(
    new ApiResponse(200, 'OTP sent successfully', {
      phone,
      expires_in_minutes: expiryMinutes,
      // Returned in development mode for easy testing without SMS gateway
      ...(process.env.NODE_ENV !== 'production' && { dev_otp_code: otpCode })
    })
  );
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp_code, full_name } = verifyOtpSchema.parse(req.body);

  const [otpRows] = await pool.query(
    `SELECT id, otp_code, expires_at, is_used
     FROM otp_verifications
     WHERE phone = ? AND is_used = FALSE AND expires_at > NOW()
     ORDER BY id DESC
     LIMIT 1`,
    [phone]
  );

  if (!otpRows.length || otpRows[0].otp_code !== otp_code) {
    throw new ApiError(400, 'Invalid or expired OTP code.');
  }

  await pool.query('UPDATE otp_verifications SET is_used = TRUE WHERE id = ?', [
    otpRows[0].id
  ]);

  // Check if user exists, otherwise create a new TRAVELER account
  let [userRows] = await pool.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]);

  let isNewUser = false;
  if (!userRows.length) {
    isNewUser = true;
    const defaultName = full_name || `Traveler ${phone.slice(-4)}`;
    const [insertResult] = await pool.query(
      `INSERT INTO users (full_name, phone, role, is_phone_verified, last_login_at)
       VALUES (?, ?, 'TRAVELER', TRUE, NOW())`,
      [defaultName, phone]
    );

    await pool.query(
      `INSERT INTO traveler_preferences (user_id) VALUES (?)`,
      [insertResult.insertId]
    );

    [userRows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [
      insertResult.insertId
    ]);
  } else {
    await pool.query(
      'UPDATE users SET is_phone_verified = TRUE, last_login_at = NOW() WHERE id = ?',
      [userRows[0].id]
    );
  }

  const user = userRows[0];
  const tokens = generateTokens(user);

  return res.status(200).json(
    new ApiResponse(200, isNewUser ? 'Account created and verified via OTP' : 'Login successful', {
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_phone_verified: Boolean(user.is_phone_verified)
      },
      ...tokens
    })
  );
});

export const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role } = registerSchema.parse(req.body);

  const [existing] = await pool.query(
    'SELECT id FROM users WHERE phone = ? OR email = ? LIMIT 1',
    [phone, email]
  );

  if (existing.length) {
    throw new ApiError(409, 'A user with this phone number or email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const connection = await pool.getConnection();
  let userId;
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, last_login_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [full_name, email, phone, passwordHash, role]
    );
    userId = result.insertId;

    await connection.query(
      `INSERT INTO traveler_preferences (user_id, preferred_trip_types)
       VALUES (?, JSON_ARRAY('STRANGER_GROUP', 'WEEKEND_NICHE'))`,
      [userId]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const [userRows] = await pool.query(
    'SELECT id, full_name, email, phone, role, is_phone_verified, created_at FROM users WHERE id = ?',
    [userId]
  );

  const user = userRows[0];
  const tokens = generateTokens(user);

  return res.status(201).json(
    new ApiResponse(201, 'User registered successfully', {
      user,
      ...tokens
    })
  );
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE phone = ? OR email = ? LIMIT 1',
    [identifier, identifier]
  );

  if (!rows.length || !rows[0].password_hash) {
    throw new ApiError(401, 'Invalid credentials or account uses OTP login.');
  }

  const user = rows[0];
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const tokens = generateTokens(user);

  return res.status(200).json(
    new ApiResponse(200, 'Login successful', {
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_phone_verified: Boolean(user.is_phone_verified)
      },
      ...tokens
    })
  );
});

export const getMe = asyncHandler(async (req, res) => {
  const [prefRows] = await pool.query(
    'SELECT * FROM traveler_preferences WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );

  let operatorProfile = null;
  if (req.user.role === 'OPERATOR') {
    const [opRows] = await pool.query(
      'SELECT id, business_name, slug, operator_type, base_city, kyc_status, rating_avg, total_completed_trips FROM operators WHERE user_id = ? LIMIT 1',
      [req.user.id]
    );
    operatorProfile = opRows[0] || null;
  }

  return res.status(200).json(
    new ApiResponse(200, 'Current user profile fetched successfully', {
      user: req.user,
      traveler_preferences: prefRows[0] || null,
      operator_profile: operatorProfile
    })
  );
});

export const updateTravelerPreferences = asyncHandler(async (req, res) => {
  const validated = travelerPreferencesSchema.parse(req.body);

  await pool.query(
    `INSERT INTO traveler_preferences (
       user_id, pace_preference, morning_style, social_style,
       comfort_preference, preferred_trip_types, age_bracket, gender, home_city
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       pace_preference = COALESCE(VALUES(pace_preference), pace_preference),
       morning_style = COALESCE(VALUES(morning_style), morning_style),
       social_style = COALESCE(VALUES(social_style), social_style),
       comfort_preference = COALESCE(VALUES(comfort_preference), comfort_preference),
       preferred_trip_types = COALESCE(VALUES(preferred_trip_types), preferred_trip_types),
       age_bracket = COALESCE(VALUES(age_bracket), age_bracket),
       gender = COALESCE(VALUES(gender), gender),
       home_city = COALESCE(VALUES(home_city), home_city)`,
    [
      req.user.id,
      validated.pace_preference || 'BALANCED',
      validated.morning_style || 'FLEXIBLE',
      validated.social_style || 'BALANCED_SOCIAL',
      validated.comfort_preference || 'STANDARD_COMFORT',
      validated.preferred_trip_types ? JSON.stringify(validated.preferred_trip_types) : null,
      validated.age_bracket || null,
      validated.gender || null,
      validated.home_city || null
    ]
  );

  const [updated] = await pool.query(
    'SELECT * FROM traveler_preferences WHERE user_id = ? LIMIT 1',
    [req.user.id]
  );

  return res.status(200).json(
    new ApiResponse(200, 'Traveler compatibility preferences updated', updated[0])
  );
});
