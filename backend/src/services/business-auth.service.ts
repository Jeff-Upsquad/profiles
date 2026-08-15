import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { markInvitationAccepted } from './invite.service.js';
import { hashPassword, comparePassword, generateTempPassword } from '../lib/password.js';
import { phoneMatchSuffix } from '../lib/phone.js';

const SESSION_DURATION_HOURS = 24;

export async function findBusinessUser(
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

/**
 * After signup/activation with a real email: stamp that email onto any phone-
 * only submitted cards owned by this business user, and ask Squad CRM to
 * backfill CRM contact persons + Hub submissions/cards matched by phone.
 * Best-effort — never throws into the signup path.
 */
async function afterBusinessSignupEmailLinked(input: {
  businessUserId: string;
  email: string;
  phone: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;

  try {
    const { error } = await supabaseAdmin
      .from('subscription_cards')
      .update({ business_email: email })
      .eq('business_user_id', input.businessUserId)
      .is('business_email', null);
    if (error) {
      console.error('[business-auth] failed to stamp card business_email', error.message);
    }
  } catch (err) {
    console.error('[business-auth] card business_email stamp threw', err);
  }

  const apiUrl = (env.SQUADCRM_API_URL || '').replace(/\/$/, '');
  const secret = env.SQUADCRM_PROVISION_SECRET || '';
  if (!apiUrl || !secret) {
    if (!apiUrl) {
      console.warn('[business-auth] SQUADCRM_API_URL unset — skipping CRM email backfill');
    }
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/integrations/squadhire/email-backfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SquadCRM-Signature': secret,
      },
      body: JSON.stringify({ phone: input.phone, email }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(
        `[business-auth] CRM email-backfill failed ${res.status}: ${text.slice(0, 300)}`,
      );
    }
  } catch (err) {
    console.error('[business-auth] CRM email-backfill request failed', err);
  }
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

/**
 * Identity check for SquadHub's first-login credential seeding.
 *
 * SquadHub calls this (server-to-server, shared secret) the first time an
 * invited business user signs in there: if the email + password they typed are
 * their real SquadHire credentials, SquadHub creates their account with that
 * same password. From then on the two logins are independent — nothing is
 * synced, and no password ever flows back the other way.
 *
 * Deliberately narrower than `businessLogin`:
 *   • It mints no token and opens no session — identity only.
 *   • It only ever validates against a real bcrypt hash. Legacy passwordless
 *     accounts (`password_required === false`) log in here with no password at
 *     all, so honouring that would let anyone who knows the email choose an
 *     arbitrary SquadHub password. Those accounts return valid:false.
 *   • Every rejection looks the same to the caller — unknown email, wrong
 *     password, inactive, expired and not-yet-activated are indistinguishable,
 *     so this can't be used to enumerate accounts.
 */
export async function verifyBusinessCredentials(input: {
  email: string;
  password: string;
}): Promise<
  | { valid: false }
  | {
      valid: true;
      business_user_id: string;
      email: string | null;
      phone: string | null;
      name: string | null;
      company_name: string | null;
    }
> {
  const businessUser = await findBusinessUser({ email: input.email }, { requireActive: true });
  if (!businessUser) return { valid: false };

  // No hash on file → provisioned/invited but never activated, or a legacy
  // passwordless account. Either way there's no credential to verify against.
  if (!businessUser.password_hash) return { valid: false };

  const ok = await comparePassword(input.password, businessUser.password_hash);
  if (!ok) return { valid: false };

  return {
    valid: true,
    business_user_id: businessUser.id,
    email: businessUser.contact_email ?? null,
    phone: businessUser.contact_phone ?? null,
    name: businessUser.contact_person_name ?? null,
    company_name: businessUser.company_name ?? null,
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

    void afterBusinessSignupEmailLinked({
      businessUserId: created.id as string,
      email,
      phone,
    });

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

  void afterBusinessSignupEmailLinked({
    businessUserId: updated.id as string,
    email,
    phone,
  });

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
//
// `tempPassword` lets a caller inject the value to set (e.g. the self-serve
// reset flow, which uses a two-word password it also sends over WhatsApp). When
// omitted, a random one is generated for the admin-relay path.
export async function adminResetBusinessPassword(userId: string, tempPassword?: string) {
  const { data: user, error: fErr } = await supabaseAdmin
    .from('business_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (fErr) throw new AppError(500, fErr.message);
  if (!user) throw new AppError(404, 'Business user not found');

  const temporary_password = tempPassword ?? generateTempPassword();
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
      .select('is_active')
      .eq('id', payload.sub)
      .single();

    if (!bizUser || !bizUser.is_active) return null;

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

  // Business accounts no longer expire. Clear any leftover window and restore
  // the account so the old "Request Access" button unblocks immediately.
  const { error: updateError } = await supabaseAdmin
    .from('business_users')
    .update({
      access_expires_at: null,
      access_requested_at: null,
      is_active: true,
    })
    .eq('id', user.id);

  if (updateError) throw new AppError(500, updateError.message);

  return { message: 'Access restored. You can sign in now.' };
}
