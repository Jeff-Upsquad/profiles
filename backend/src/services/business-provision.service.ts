import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export interface ProvisionBusinessInput {
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  contact_person_name?: string | null;
  expires_at: string; // ISO timestamp — end of the access window
}

export interface ProvisionBusinessResult {
  business_user_id: string;
  created: boolean;
  access_expires_at: string | null;
}

/**
 * Provision (create-or-refresh) a business user from an external CRM.
 *
 * Idempotent: matched by email, else by normalized phone. Re-provisioning the
 * same contact extends access rather than duplicating the account, so a deal
 * bouncing in and out of the trigger stage is safe. New accounts land on the
 * password track (password_required defaults to true), so the user completes
 * first-time signup to set their password. No notification is sent.
 */
export async function provisionBusinessUser(
  input: ProvisionBusinessInput,
): Promise<ProvisionBusinessResult> {
  const email = input.email ? input.email.trim().toLowerCase() : null;
  const phone = input.phone ? input.phone.trim() : null;
  if (!email && !phone) {
    throw new AppError(400, 'Email or phone is required');
  }

  const existing = await findExisting(email, phone);

  if (existing) {
    // Keep the more generous of the current vs incoming expiry.
    const current = existing.access_expires_at
      ? new Date(existing.access_expires_at).getTime()
      : 0;
    const incoming = new Date(input.expires_at).getTime();
    const access_expires_at =
      Number.isFinite(incoming) && incoming > current
        ? input.expires_at
        : existing.access_expires_at;

    const update: Record<string, unknown> = { access_expires_at, is_active: true };
    // Backfill identity fields only where currently empty, so we never clobber
    // details the business user has already set for themselves.
    if (input.company_name && (!existing.company_name || existing.company_name === 'Unnamed Company')) {
      update.company_name = input.company_name;
    }
    if (input.contact_person_name && !existing.contact_person_name) {
      update.contact_person_name = input.contact_person_name;
    }
    if (email && !existing.contact_email) update.contact_email = email;
    if (phone && !existing.contact_phone) update.contact_phone = phone;

    const { error } = await supabaseAdmin
      .from('business_users')
      .update(update)
      .eq('id', existing.id);
    if (error) throw new AppError(500, error.message);

    return { business_user_id: existing.id, created: false, access_expires_at };
  }

  const id = crypto.randomUUID();
  const { error } = await supabaseAdmin.from('business_users').insert({
    id,
    company_name: input.company_name || 'Unnamed Company',
    contact_person_name: input.contact_person_name || '',
    contact_email: email,
    contact_phone: phone,
    access_expires_at: input.expires_at,
    is_active: true,
    verified: true,
    // password_required defaults to true (migration 00111) → first-time signup.
  });
  if (error) throw new AppError(400, error.message);

  return { business_user_id: id, created: true, access_expires_at: input.expires_at };
}

async function findExisting(email: string | null, phone: string | null) {
  if (email) {
    const { data } = await supabaseAdmin
      .from('business_users')
      .select('*')
      .eq('contact_email', email)
      .maybeSingle();
    if (data) return data;
  }
  if (phone) {
    const normalized = phone.replace(/\D/g, '');
    if (normalized) {
      const { data } = await supabaseAdmin
        .from('business_users')
        .select('*')
        .eq('contact_phone_normalized', normalized)
        .maybeSingle();
      if (data) return data;
    }
  }
  return null;
}
