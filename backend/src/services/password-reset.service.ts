// Self-serve password reset via WhatsApp.
//
// Replaces the old "message us and we'll reset it by hand" flow for both talent
// (Supabase auth) and business (custom bcrypt) accounts. Three steps, all keyed
// off the account's registered phone number:
//
//   1. lookup(phone)   → is this number registered? Returns a MASKED identity
//                        hint to confirm + a signed short-lived `reset_ticket`.
//   2. send(ticket)    → mint a two-word temp password, apply it to the account
//                        (forcing a change on next sign-in) and deliver it over
//                        WhatsApp through the SquadHire CRM.
//   3. verify(ticket, temp_password) → sign the user in with the temp password
//                        and hand back the standard auth payload; the client's
//                        must-reset routing then walks them to "set a new
//                        password".
//
// Security: the temp password is never returned to the browser (WhatsApp only);
// identity hints are masked; the ticket is a signed JWT scoped to one account
// and expires quickly; the routes that call this are rate-limited (see
// auth.routes.ts).

import jwt from 'jsonwebtoken';
import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { generateWordTempPassword } from '../lib/password.js';
import { phoneMatchSuffix, normalizePhoneDigits } from '../lib/phone.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import {
  findBusinessUser,
  adminResetBusinessPassword,
  businessLogin,
} from './business-auth.service.js';
import type {
  PasswordResetLookupResponse,
  PasswordResetSendResponse,
} from '../../../shared/src/types/auth.js';

type ResetRole = 'talent' | 'business';

interface ResetTicket {
  purpose: 'pwreset';
  role: ResetRole;
  sub: string; // account id (talent auth user id / business_users id)
  phone: string; // trailing-10-digit form the user entered
}

const TICKET_TTL_SECONDS = 10 * 60;

function issueTicket(role: ResetRole, sub: string, phone: string): string {
  const payload: ResetTicket = { purpose: 'pwreset', role, sub, phone };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TICKET_TTL_SECONDS });
}

function verifyTicket(token: string): ResetTicket {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(400, 'This reset session has expired. Please start again.');
  }
  const t = decoded as Partial<ResetTicket>;
  if (t.purpose !== 'pwreset' || !t.role || !t.sub || !t.phone) {
    throw new AppError(400, 'Invalid reset session. Please start again.');
  }
  return t as ResetTicket;
}

// Keep the first and last character, mask the middle (capped so long names
// don't leak their length). "Rahul Kumar" → "R•••••••••r", "Acme Corp" → "A•••••••p".
function maskLabel(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (v.length <= 2) return `${v[0]}•`;
  const middle = Math.min(v.length - 2, 6);
  return `${v[0]}${'•'.repeat(middle)}${v[v.length - 1]}`;
}

interface ResolvedAccount {
  role: ResetRole;
  id: string;
  name: string | null;
  business: string | null;
}

// Resolve a phone number to a single account. Business is checked first; a
// number registered to both (rare) resets the business account. Returns null
// when nothing active matches — the caller collapses that into a generic
// "not found" so the endpoint can't be used to enumerate accounts.
async function resolveByPhone(phone: string): Promise<ResolvedAccount | null> {
  const last10 = phoneMatchSuffix(phone);
  if (!last10 || last10.length < 10) return null;

  const biz = await findBusinessUser({ phone }, { requireActive: true });
  if (biz) {
    return {
      role: 'business',
      id: biz.id,
      name: biz.contact_person_name ?? null,
      business: biz.company_name ?? null,
    };
  }

  // talent_users.phone has no normalized column, so narrow by the last 4 digits
  // (a safe LIKE suffix) then confirm the full trailing-10 match in JS — this
  // stays correct even if the stored value carries a country code or separators.
  const last4 = last10.slice(-4);
  const { data: rows, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone')
    .ilike('phone', `%${last4}`)
    .limit(200);
  if (error) {
    console.error('[password-reset] talent lookup failed:', error.message);
    return null;
  }
  const match = (rows ?? []).find(
    (r) => normalizePhoneDigits(r.phone).slice(-10) === last10,
  );
  if (match) {
    return { role: 'talent', id: match.id, name: match.full_name ?? null, business: null };
  }

  return null;
}

export async function lookupAccountByPhone(
  phone: string,
): Promise<PasswordResetLookupResponse> {
  const account = await resolveByPhone(phone);
  if (!account) return { found: false };

  return {
    found: true,
    role: account.role,
    masked_name: maskLabel(account.name),
    masked_business: account.role === 'business' ? maskLabel(account.business) : null,
    reset_ticket: issueTicket(account.role, account.id, phoneMatchSuffix(phone)!),
  };
}

// Fire the CRM system event that maps to a WhatsApp template carrying the temp
// password. Business resets route through the original Squad CRM, talent resets
// through the SquadHire CRM (see deliverCrmSystemEvent); a `{skipped:true}` body
// (no approved template mapped yet) counts as "accepted but not delivered".
async function deliverTempPasswordWhatsApp(args: {
  event: 'talent_password_reset' | 'business_password_reset';
  name: string | null;
  phone: string;
  tempPassword: string;
}): Promise<boolean> {
  return deliverCrmSystemEvent({
    audience: args.event === 'business_password_reset' ? 'business' : 'talent',
    event: args.event,
    name: args.name,
    phone: args.phone,
    data: { temp_password: args.tempPassword },
  });
}

// Set a fresh Supabase password + force-reset flag on a talent account, then
// smoke-test the sign-in (mirrors admin.service.resetUserPassword) so we never
// hand out a temp password that silently doesn't work.
async function applyTalentTempPassword(userId: string, tempPassword: string): Promise<void> {
  const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getErr || !existing?.user) throw new AppError(404, 'Account not found');
  const email = existing.user.email;
  if (!email) throw new AppError(400, 'This account has no email on file.');

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { ...(existing.user.user_metadata ?? {}), must_reset_password: true },
  });
  if (error) throw new AppError(400, error.message);

  const { error: signInErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: tempPassword,
  });
  if (signInErr) {
    throw new AppError(500, 'Failed to set a temporary password. Please try again.');
  }
}

export async function sendTempPassword(ticketToken: string): Promise<PasswordResetSendResponse> {
  const ticket = verifyTicket(ticketToken);
  const tempPassword = generateWordTempPassword();

  let name: string | null = null;
  let phone: string | null = null;
  let event: 'talent_password_reset' | 'business_password_reset';

  if (ticket.role === 'business') {
    await adminResetBusinessPassword(ticket.sub, tempPassword);
    const { data: bu } = await supabaseAdmin
      .from('business_users')
      .select('contact_person_name, contact_phone')
      .eq('id', ticket.sub)
      .maybeSingle();
    name = bu?.contact_person_name ?? null;
    phone = bu?.contact_phone ?? null;
    event = 'business_password_reset';
  } else {
    await applyTalentTempPassword(ticket.sub, tempPassword);
    const { data: tu } = await supabaseAdmin
      .from('talent_users')
      .select('full_name, phone')
      .eq('id', ticket.sub)
      .maybeSingle();
    name = tu?.full_name ?? null;
    phone = tu?.phone ?? null;
    event = 'talent_password_reset';
  }

  // The temp password is a live credential — never log it by default. For local
  // debugging while WhatsApp delivery is being wired up, opt in explicitly with
  // PASSWORD_RESET_DEBUG=1 (must NOT be set in production).
  if (process.env.PASSWORD_RESET_DEBUG === '1') {
    console.log(`[password-reset] temp password for ${ticket.role} ${ticket.sub}: ${tempPassword}`);
  }

  const delivered = phone
    ? await deliverTempPasswordWhatsApp({ event, name, phone, tempPassword })
    : false;

  return { sent: true, delivered };
}

// Verify the temp password by actually signing the user in. Returns the same
// payload shape the normal login endpoints do (talent → tokens; business →
// access_token + must_change_password) so the client stores it directly.
export async function verifyTempPassword(ticketToken: string, tempPassword: string) {
  const ticket = verifyTicket(ticketToken);
  const candidate = tempPassword.trim().toLowerCase();

  if (ticket.role === 'business') {
    const res = await businessLogin({ phone: ticket.phone, password: candidate });
    if (res.status !== 'ok') {
      throw new AppError(400, 'Could not sign you in. Please start the reset again.');
    }
    const { status, ...payload } = res;
    return payload;
  }

  const { data: existing } = await supabaseAdmin.auth.admin.getUserById(ticket.sub);
  const email = existing?.user?.email;
  if (!email) throw new AppError(400, 'This account has no email on file.');

  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email,
    password: candidate,
  });
  if (error || !data.session) {
    throw new AppError(401, 'Incorrect temporary password. Please check and try again.');
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { id: data.user.id, email, role: 'talent' as const },
  };
}
