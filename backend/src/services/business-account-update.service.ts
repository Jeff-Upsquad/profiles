// Authenticated login-detail change for business users, gated by a one-time
// code delivered to the account's registered WhatsApp number.
//
// A signed-in business user can change their login email, login phone, or
// password. Each change follows the same two steps as the forgot-password flow:
//
//   1. send(field)          → mint a 6-digit code, deliver it over WhatsApp
//                             (via the SquadHire CRM), and hand back a signed
//                             short-lived `ticket` scoped to this account+field.
//   2. verify(ticket, code, → re-check the code, then apply the new value to
//            new_value)        the account.
//
// Security notes:
//   * The code is delivered ONLY over WhatsApp — never returned to the browser.
//   * The ticket is a signed JWT carrying an HMAC of the code (keyed with
//     JWT_SECRET), not the code itself, so a client that holds the ticket still
//     cannot recover or offline-brute-force the low-entropy code.
//   * The ticket is bound to one account id (from the caller's session) and one
//     field, and expires in 10 minutes.
//   * The send/verify routes are authenticated and rate-limited (auth.routes).

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { generateNumericCode, hashPassword } from '../lib/password.js';
import { phoneMatchSuffix } from '../lib/phone.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import type {
  LoginDetailField,
  LoginUpdateSendResponse,
  LoginUpdateVerifyResponse,
} from '../../../shared/src/types/auth.js';

const TICKET_TTL_SECONDS = 10 * 60;

interface UpdateTicket {
  purpose: 'login_update';
  sub: string; // business_users.id
  field: LoginDetailField;
  code_hash: string; // HMAC-SHA256(JWT_SECRET, `${sub}:${field}:${code}`)
}

// Keyed HMAC of the code. Because the key is JWT_SECRET (server-only), a client
// holding the ticket cannot verify guessed codes offline — the online verify
// endpoint is the only oracle, and it is rate-limited.
function hashCode(sub: string, field: LoginDetailField, code: string): string {
  return crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${sub}:${field}:${code}`)
    .digest('hex');
}

function issueTicket(sub: string, field: LoginDetailField, code: string): string {
  const payload: UpdateTicket = {
    purpose: 'login_update',
    sub,
    field,
    code_hash: hashCode(sub, field, code),
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TICKET_TTL_SECONDS });
}

function verifyTicket(token: string): UpdateTicket {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new AppError(400, 'This verification session has expired. Please start again.');
  }
  const t = decoded as Partial<UpdateTicket>;
  if (t.purpose !== 'login_update' || !t.sub || !t.field || !t.code_hash) {
    throw new AppError(400, 'Invalid verification session. Please start again.');
  }
  return t as UpdateTicket;
}

// Show only the last two digits of the registered number so the user can
// confirm which WhatsApp the code went to without exposing the full number.
function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 2) return '••••';
  return `•••• ••${digits.slice(-2)}`;
}

async function loadBusinessUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select('id, contact_person_name, contact_email, contact_phone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Account not found');
  return data;
}

export async function sendLoginUpdateCode(
  userId: string,
  field: LoginDetailField,
): Promise<LoginUpdateSendResponse> {
  const user = await loadBusinessUser(userId);
  if (!user.contact_phone || !phoneMatchSuffix(user.contact_phone)) {
    throw new AppError(
      400,
      'No WhatsApp number is on file for your account, so we can’t verify this change. Please contact support.',
    );
  }

  const code = generateNumericCode(6);
  const ticket = issueTicket(user.id, field, code);

  // Never log the live code by default. Opt in locally with LOGIN_UPDATE_DEBUG=1
  // (must NOT be set in production) while the WhatsApp template is being wired.
  if (process.env.LOGIN_UPDATE_DEBUG === '1') {
    console.log(`[login-update] code for business ${user.id} (${field}): ${code}`);
  }

  // Business codes route through the original Squad CRM (talent → SquadHire CRM).
  const delivered = await deliverCrmSystemEvent({
    audience: 'business',
    event: 'business_login_update_code',
    name: user.contact_person_name ?? null,
    phone: user.contact_phone,
    data: { code },
  });

  return { sent: true, delivered, masked_phone: maskPhone(user.contact_phone), ticket };
}

// Ensure no OTHER business account already uses this email (case-insensitive).
async function assertEmailAvailable(email: string, selfId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select('id')
    .eq('contact_email', email)
    .neq('id', selfId)
    .limit(1);
  if (error) throw new AppError(500, error.message);
  if ((data ?? []).length > 0) {
    throw new AppError(409, 'That email is already used by another account.');
  }
}

export async function verifyAndApplyLoginUpdate(
  userId: string,
  ticketToken: string,
  code: string,
  newValue: string,
): Promise<LoginUpdateVerifyResponse> {
  const ticket = verifyTicket(ticketToken);

  // The ticket is bound to the account that requested it; reject a ticket minted
  // for a different session even if it verifies.
  if (ticket.sub !== userId) {
    throw new AppError(403, 'This verification session does not match your account.');
  }

  const submitted = (code ?? '').trim();
  const expected = hashCode(ticket.sub, ticket.field, submitted);
  // Constant-time compare so a timing side channel can't leak the code.
  const ok =
    expected.length === ticket.code_hash.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(ticket.code_hash));
  if (!ok) {
    throw new AppError(401, 'Incorrect code. Please check and try again.');
  }

  const value = (newValue ?? '').trim();

  if (ticket.field === 'email') {
    const email = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(400, 'Please enter a valid email address.');
    }
    await assertEmailAvailable(email, userId);
    const { error } = await supabaseAdmin
      .from('business_users')
      .update({ contact_email: email })
      .eq('id', userId);
    if (error) throw new AppError(500, error.message);
  } else if (ticket.field === 'phone') {
    // contact_phone_normalized is a generated column — updating contact_phone
    // refreshes it automatically.
    if (!phoneMatchSuffix(value)) {
      throw new AppError(400, 'Please enter a valid phone number.');
    }
    const { error } = await supabaseAdmin
      .from('business_users')
      .update({ contact_phone: value })
      .eq('id', userId);
    if (error) throw new AppError(500, error.message);
  } else {
    if (value.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters.');
    }
    const password_hash = await hashPassword(value);
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
  }

  return { success: true, field: ticket.field };
}
