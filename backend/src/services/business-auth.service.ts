import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { markInvitationAccepted } from './invite.service.js';
import { hashPassword, comparePassword, generateTempPassword } from '../lib/password.js';
import { phoneMatchSuffix } from '../lib/phone.js';

const SESSION_DURATION_HOURS = 24;

async function findBusinessUser(
  identifier: { email?: string; phone?: string },
  opts: { requireActive?: boolean } = {}
) {
  if (identifier.email) {
    let qb = supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('contact_email', identifier.email.toLowerCase());
    if (opts.requireActive) qb = qb.eq('is_active', true);
    const { data, error } = await qb.maybeSingle();
    if (error) throw new AppError(500, error.message);
    return data;
  }

  if (identifier.phone) {
    // Match on the trailing 10 digits so a number stored with a country code
    // (signup stores "+91…") is still found when the login form sends only the
    // national number — otherwise login and signup deadlock: login reports "no
    // account" while signup reports "already set up" for the same phone.
    const suffix = phoneMatchSuffix(identifier.phone);
    if (!suffix) return null;
    let qb = supabaseAdmin
      .from('business_users')
      .select('*')
      .like('contact_phone_normalized', `%${suffix}`);
    if (opts.requireActive) qb = qb.eq('is_active', true);
    const { data, error } = await qb.order('created_at', { ascending: false });
    if (error) throw new AppError(500, error.message);
    const rows = data ?? [];
    if (rows.length <= 1) return rows[0] ?? null;
    // Legacy data can hold two rows sharing these last 10 digits (one stored
    // with a country code, one without). Prefer an activated account so the
    // user can actually log in; otherwise take the most recent.
    return rows.find((r) => r.password_hash) ?? rows[0];
  }

  return null;
}

// Mint a business JWT + revocable session row and return the standard login
// payload. Shared by password login, first-time signup/activation, and the
// legacy passwordless path so the token/session shape never drifts.
async function issueBusinessSession(
  businessUser: any,
  extra: { must_change_password?: boolean } = {},
) {
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

  const { error: sessionError } = await supabaseAdmin
    .from('business_sessions')
    .insert({
      business_user_id: businessUser.id,
      token,
      expires_at: sessionExpiry.toISOString(),
    });
  if (sessionError) throw new AppError(500, 'Failed to create session');

  // Mark linked invitation as accepted on first login / activation.
  if (businessUser.invitation_id) {
    try {
      await markInvitationAccepted(businessUser.invitation_id);
    } catch {
      // Non-fatal: don't block login if invitation update fails
    }
  }

  return {
    access_token: token,
    must_change_password: extra.must_change_password ?? false,
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

// Login result is discriminated: `needs_signup` means a provisioned/invited
// account exists on the password track but hasn't set a password yet, so the
// client should route the user to first-time signup rather than show an error.
export async function businessLogin(identifier: {
  email?: string;
  phone?: string;
  password?: string;
}) {
  if (!identifier.email && !identifier.phone) {
    throw new AppError(400, 'Email or phone is required');
  }

  const businessUser = await findBusinessUser(identifier, { requireActive: true });
  if (!businessUser) {
    throw new AppError(
      401,
      identifier.email
        ? 'No account found for this email. Sign up to create one.'
        : 'No account found for this phone number. Sign up to create one.'
    );
  }

  // Check expiration
  if (businessUser.access_expires_at && new Date(businessUser.access_expires_at) < new Date()) {
    throw new AppError(403, 'Your access has expired. Please contact the administrator.');
  }

  // Legacy users (grandfathered by migration 00111, password_required = false)
  // keep logging in with just their identifier — any password field is ignored.
  if (businessUser.password_required === false) {
    return { status: 'ok' as const, ...(await issueBusinessSession(businessUser)) };
  }

  // Password track. No hash yet → account provisioned/invited but not activated.
  if (!businessUser.password_hash) {
    return { status: 'needs_signup' as const };
  }

  const ok = await comparePassword(identifier.password ?? '', businessUser.password_hash);
  if (!ok) {
    throw new AppError(401, 'Incorrect password. Please try again.');
  }

  return {
    status: 'ok' as const,
    ...(await issueBusinessSession(businessUser, {
      must_change_password: businessUser.must_change_password === true,
    })),
  };
}

// Open self-serve signup. Anyone can create a business account from the signup
// page — no invitation required. Both email and phone are required. Two paths:
//   * No existing row for email or phone → create a brand-new account.
//   * An already-provisioned/invited row exists → activate it (set password,
//     confirm name + business name, fill any missing contact fields).
// Either way the resulting account never expires (access_expires_at stays / is
// cleared to null), so a signed-up account is kept forever.
export async function businessSignup(input: {
  email: string;
  phone: string;
  name: string;
  company_name: string;
  password: string;
}) {
  if (!input.email?.trim() || !input.phone?.trim()) {
    throw new AppError(400, 'Email and phone are required');
  }

  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const password_hash = await hashPassword(input.password);

  // Resolve by email first, then phone, so an invite that only stored one
  // contact method still activates instead of creating a duplicate.
  const byEmail = await findBusinessUser({ email });
  const byPhone = await findBusinessUser({ phone });
  if (byEmail && byPhone && byEmail.id !== byPhone.id) {
    throw new AppError(
      409,
      'This email and phone number belong to different accounts. Please contact support.',
    );
  }
  const user = byEmail ?? byPhone;

  // ── New account: open registration ────────────────────────────────────────
  if (!user) {
    const { data: created, error } = await supabaseAdmin
      .from('business_users')
      .insert({
        id: crypto.randomUUID(),
        company_name: input.company_name,
        contact_person_name: input.name,
        contact_email: email,
        contact_phone: phone,
        password_hash,
        password_set_at: new Date().toISOString(),
        password_required: true,
        must_change_password: false,
        is_active: true,
        verified: false,
        access_expires_at: null,
      })
      .select('*')
      .single();
    if (error || !created) throw new AppError(500, 'Failed to create account');

    return { status: 'ok' as const, ...(await issueBusinessSession(created)) };
  }

  // ── Existing account: activation of a provisioned/invited row ──────────────
  if (!user.is_active) {
    throw new AppError(403, 'Your account is inactive. Please contact the administrator.');
  }
  if (user.password_required === false) {
    throw new AppError(400, 'This account already has access. Please log in.');
  }
  if (user.password_hash) {
    throw new AppError(409, 'This account is already set up. Please log in with your password.');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('business_users')
    .update({
      password_hash,
      password_set_at: new Date().toISOString(),
      must_change_password: false,
      contact_person_name: input.name,
      company_name: input.company_name,
      contact_email: email,
      contact_phone: phone,
      // Completing signup clears any admin-set expiry — the account is forever.
      access_expires_at: null,
    })
    .eq('id', user.id)
    .select('*')
    .single();
  if (error || !updated) throw new AppError(500, 'Failed to complete signup');

  return { status: 'ok' as const, ...(await issueBusinessSession(updated)) };
}

// Authenticated self-service change. Also clears the forced-change flag set by
// an admin reset, so this doubles as the "change your temporary password" step.
export async function changeBusinessPassword(
  userId: string,
  input: { current_password: string; new_password: string },
) {
  const { data: user, error: fErr } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (fErr) throw new AppError(500, fErr.message);
  if (!user) throw new AppError(404, 'Account not found');

  const ok = await comparePassword(input.current_password, user.password_hash);
  if (!ok) throw new AppError(401, 'Current password is incorrect');

  const password_hash = await hashPassword(input.new_password);
  const { error } = await supabaseAdmin
    .from('business_users')
    .update({
      password_hash,
      password_set_at: new Date().toISOString(),
      must_change_password: false,
      password_required: true,
    })
    .eq('id', userId);
  if (error) throw new AppError(500, error.message);

  return { success: true };
}

// Admin-triggered reset: sets a temporary password and forces a change on next
// login. Returns the temp password ONCE so the admin can relay it over WhatsApp.
// Existing sessions are dropped so a stale token can't bypass the forced change.
export async function adminResetBusinessPassword(userId: string) {
  const { data: user, error: fErr } = await supabaseAdmin
    .from('business_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (fErr) throw new AppError(500, fErr.message);
  if (!user) throw new AppError(404, 'Business user not found');

  const temporary_password = generateTempPassword();
  const password_hash = await hashPassword(temporary_password);
  const { error } = await supabaseAdmin
    .from('business_users')
    .update({
      password_hash,
      must_change_password: true,
      password_required: true,
    })
    .eq('id', userId);
  if (error) throw new AppError(500, error.message);

  await supabaseAdmin.from('business_sessions').delete().eq('business_user_id', userId);

  return { temporary_password };
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
