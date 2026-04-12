import jwt from 'jsonwebtoken';
import { queryPg, queryPgOne } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

const SESSION_DURATION_HOURS = 24;

export async function businessLogin(email: string) {
  // Look up business user by contact_email
  const businessUser = await queryPgOne(
    `SELECT * FROM business_users WHERE contact_email = $1 AND is_active = true`,
    [email.toLowerCase()]
  );

  if (!businessUser) throw new AppError(401, 'No account found for this email. Please contact the administrator.');

  // Check expiration
  if (businessUser.access_expires_at && new Date(businessUser.access_expires_at) < new Date()) {
    throw new AppError(403, 'Your access has expired. Please contact the administrator.');
  }

  // Generate JWT
  const sessionExpiry = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const token = jwt.sign(
    {
      sub: businessUser.id,
      email: email.toLowerCase(),
      role: 'business',
    },
    env.JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_HOURS}h` }
  );

  // Store session
  await queryPg(
    `INSERT INTO business_sessions (business_user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [businessUser.id, token, sessionExpiry.toISOString()]
  );

  return {
    access_token: token,
    user: {
      id: businessUser.id,
      email: email.toLowerCase(),
      role: 'business' as const,
      company_name: businessUser.company_name,
      contact_person_name: businessUser.contact_person_name,
      access_expires_at: businessUser.access_expires_at,
    },
  };
}

export async function validateBusinessToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      email: string;
      role: string;
    };

    if (payload.role !== 'business') return null;

    // Verify session exists and is not expired
    const session = await queryPgOne(
      `SELECT id, expires_at FROM business_sessions WHERE token = $1`,
      [token]
    );

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await queryPg(`DELETE FROM business_sessions WHERE id = $1`, [session.id]);
      return null;
    }

    // Also check if business user's access has expired
    const bizUser = await queryPgOne(
      `SELECT is_active, access_expires_at FROM business_users WHERE id = $1`,
      [payload.sub]
    );

    if (!bizUser || !bizUser.is_active) return null;
    if (bizUser.access_expires_at && new Date(bizUser.access_expires_at) < new Date()) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: 'business' as const,
    };
  } catch {
    return null;
  }
}

export async function businessLogout(token: string) {
  await queryPg(`DELETE FROM business_sessions WHERE token = $1`, [token]);
}
