import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { markInvitationAccepted } from './invite.service.js';

const SESSION_DURATION_HOURS = 24;

async function findBusinessUser(
  identifier: { email?: string; phone?: string },
  opts: { requireActive?: boolean } = {}
) {
  let qb = supabaseAdmin.from('business_users').select('*');
  if (identifier.email) {
    qb = qb.eq('contact_email', identifier.email.toLowerCase());
  } else if (identifier.phone) {
    const normalized = identifier.phone.replace(/\D/g, '');
    if (!normalized) return null;
    qb = qb.eq('contact_phone_normalized', normalized);
  } else {
    return null;
  }
  if (opts.requireActive) qb = qb.eq('is_active', true);

  const { data, error } = await qb.maybeSingle();
  if (error) throw new AppError(500, error.message);
  return data;
}

export async function businessLogin(identifier: { email?: string; phone?: string }) {
  if (!identifier.email && !identifier.phone) {
    throw new AppError(400, 'Email or phone is required');
  }

  const businessUser = await findBusinessUser(identifier, { requireActive: true });
  if (!businessUser) {
    throw new AppError(
      401,
      identifier.email
        ? 'No account found for this email. Please contact the administrator.'
        : 'No account found for this phone number. Please contact the administrator.'
    );
  }

  // Check expiration
  if (businessUser.access_expires_at && new Date(businessUser.access_expires_at) < new Date()) {
    throw new AppError(403, 'Your access has expired. Please contact the administrator.');
  }

  // Generate JWT
  const sessionExpiry = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const token = jwt.sign(
    {
      sub: businessUser.id,
      email: businessUser.contact_email,
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

  // Mark linked invitation as accepted on first login
  if (businessUser.invitation_id) {
    try {
      await markInvitationAccepted(businessUser.invitation_id);
    } catch {
      // Non-fatal: don't block login if invitation update fails
    }
  }

  return {
    access_token: token,
    user: {
      id: businessUser.id,
      email: businessUser.contact_email,
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

export async function refreshSession(oldToken: string, userId: string) {
  const { data: businessUser, error: fetchError } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError || !businessUser) throw new AppError(401, 'Account not found');
  if (!businessUser.is_active) throw new AppError(403, 'Account is inactive');
  if (
    businessUser.access_expires_at &&
    new Date(businessUser.access_expires_at) < new Date()
  ) {
    throw new AppError(403, 'Your access has expired. Please contact the administrator.');
  }

  const sessionExpiry = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const newToken = jwt.sign(
    {
      sub: businessUser.id,
      email: businessUser.contact_email,
      role: 'business',
    },
    env.JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_HOURS}h` }
  );

  // Insert new session first, then delete the old row. If the insert fails the
  // old session is still valid; if the delete fails we leave a brief duplicate
  // (validateBusinessToken still works on the new row, the old one ages out).
  const { error: insertError } = await supabaseAdmin
    .from('business_sessions')
    .insert({
      business_user_id: businessUser.id,
      token: newToken,
      expires_at: sessionExpiry.toISOString(),
    });

  if (insertError) throw new AppError(500, 'Failed to refresh session');

  await supabaseAdmin.from('business_sessions').delete().eq('token', oldToken);

  return {
    access_token: newToken,
    user: {
      id: businessUser.id,
      email: businessUser.contact_email,
      role: 'business' as const,
      company_name: businessUser.company_name,
      contact_person_name: businessUser.contact_person_name,
      access_expires_at: businessUser.access_expires_at,
    },
  };
}

export async function requestAccess(identifier: { email?: string; phone?: string }) {
  if (!identifier.email && !identifier.phone) {
    throw new AppError(400, 'Email or phone is required');
  }

  const user = await findBusinessUser(identifier);
  if (!user) throw new AppError(404, 'No account found.');

  if (!user.access_expires_at || new Date(user.access_expires_at) >= new Date()) {
    throw new AppError(400, 'Your access has not expired.');
  }

  const { error: updateError } = await supabaseAdmin
    .from('business_users')
    .update({ access_requested_at: new Date().toISOString() })
    .eq('id', user.id);

  if (updateError) throw new AppError(500, updateError.message);

  return { message: 'Your request has been sent to the administrator.' };
}
