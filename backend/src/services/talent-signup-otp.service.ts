import { createHmac, randomUUID } from 'node:crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { generateNumericCode } from '../lib/password.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';

export function signupPhone(phone: string): string {
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new AppError(400, 'Enter a valid WhatsApp number including country code.');
  }
  return normalized;
}

function hashCode(id: string, phone: string, email: string, code: string): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(JSON.stringify(['talent_signup', id, phone, email, code])).digest('hex');
}

export async function sendTalentSignupCode(input: { phone: string; email: string; full_name?: string }) {
  const phone = signupPhone(input.phone);
  const email = input.email.trim().toLowerCase();
  const challengeId = randomUUID();
  const code = generateNumericCode(6);
  const { data: reserved, error } = await supabaseAdmin.rpc('reserve_talent_signup_code', {
    p_phone: phone, p_email: email, p_challenge_id: challengeId,
    p_code_hash: hashCode(challengeId, phone, email, code),
  });
  if (error) throw new AppError(503, 'WhatsApp verification is unavailable. Please try again later.');
  if (reserved !== true) throw new AppError(429, 'Please wait before requesting another code. You can request up to 5 codes per hour.');

  const delivered = await deliverCrmSystemEvent({
    audience: 'talent', event: 'talent_signup_verification_code',
    name: input.full_name?.trim() || null, phone,
    data: { code }, bodyParams: [code],
  });
  if (!delivered) throw new AppError(503, 'We could not send your WhatsApp code. Please wait a minute and try again.');
  const { data: activated, error: activationError } = await supabaseAdmin.from('talent_signup_challenges')
    .update({ delivered: true }).eq('phone', phone).eq('challenge_id', challengeId).select('challenge_id');
  if (activationError || !activated?.length) throw new AppError(503, 'Could not start verification. Please request a new code.');
  return { challenge_id: challengeId, expires_in: 600, resend_after: 60 };
}

export async function consumeTalentSignupCode(phoneInput: string, emailInput: string, otp?: { challenge_id: string; code: string }) {
  const phone = signupPhone(phoneInput);
  if (!otp || !/^[0-9]{6}$/.test(otp.code)) throw new AppError(400, 'Verify your WhatsApp number before creating your account.');
  const email = emailInput.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.rpc('consume_talent_signup_code', {
    p_phone: phone, p_email: email, p_challenge_id: otp.challenge_id,
    p_code_hash: hashCode(otp.challenge_id, phone, email, otp.code),
  });
  if (error) throw new AppError(503, 'WhatsApp verification is unavailable. Please try again later.');
  if (data !== true) throw new AppError(400, 'Incorrect or expired WhatsApp code. After 5 attempts, request a new code.');
  return phone;
}
