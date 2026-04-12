import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

const SESSION_DURATION_HOURS = 24;

export async function businessLogin(email: string) {
  // Look up business user by contact_email
  const { data: businessUser, error } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .eq('contact_email', email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
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
  const { error: sessionError } = await supabaseAdmin
    .from('business_sessions')
    .insert({
      business_user_id: businessUser.id,
      token,
      expires_at: sessionExpiry.toISOString(),
    });

  if (sessionError) throw new AppError(500, 'Failed to create session');

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
    const { data: session } = await supabaseAdmin
      .from('business_sessions')
      .select('id, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await supabaseAdmin.from('business_sessions').delete().eq('id', session.id);
      return null;
    }

    // Also check if business user's access has expired
    const { data: bizUser } = await supabaseAdmin
      .from('business_users')
      .select('is_active, access_expires_at')
      .eq('id', payload.sub)
      .single();

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
  await supabaseAdmin.from('business_sessions').delete().eq('token', token);
}
