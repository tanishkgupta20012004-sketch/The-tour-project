import jwt from 'jsonwebtoken';

export function generateTokens(user) {
  const payload = {
    id: user.id,
    role: user.role,
    phone: user.phone
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET || 'tour_marketplace_access_secret_key_2026',
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1d' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET || 'tour_marketplace_refresh_secret_key_2026',
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
}
