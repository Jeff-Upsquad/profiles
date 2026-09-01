import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { resolveCategorySlug } from './squadhub-talent-sso.service.js';

const REQUEST_TIMEOUT_MS = 10_000;

export interface ProvisionAssignedTalentInput {
  cardId: string;
  talentUserId: string;
  categoryIds: string[];
}

export interface ProvisionAssignedTalentResult {
  userId: string;
  created: boolean;
}

function squadhubBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

/**
 * Generate a random temporary password (16 chars, alphanumeric).
 */
function generateTempPassword(): string {
  return randomBytes(12).toString('base64url').slice(0, 16);
}

/**
 * Look up the email for a talent from their linked lead_submissions row.
 * Returns null if no linked lead with an email is found.
 */
async function resolveEmailFromLead(talentUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('email')
    .eq('linked_talent_user_id', talentUserId)
    .not('email', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.email) return null;
  return (data.email as string).trim().toLowerCase();
}

/**
 * Create or reconcile the SquadHub partner account for an activated talent.
 * The endpoint is idempotent and independently verifies that this talent is
 * assigned to this card on SquadHub before creating anything.
 *
 * If the talent has no Supabase Auth account yet, one is auto-created using
 * the email from their linked lead. A temporary password is generated so the
 * talent can log in to the partner app immediately.
 */
export async function provisionAssignedTalent(
  input: ProvisionAssignedTalentInput,
): Promise<ProvisionAssignedTalentResult> {
  const base = squadhubBase();
  const secret = env.SQUADHUB_CALLBACK_SECRET;
  if (!base || !secret) {
    throw new AppError(503, 'SquadHub talent provisioning is not configured');
  }

  const [talentResult, authResult, categorySlug] = await Promise.all([
    supabaseAdmin
      .from('talent_users')
      .select('id, full_name, phone')
      .eq('id', input.talentUserId)
      .maybeSingle(),
    supabaseAdmin.auth.admin.getUserById(input.talentUserId),
    resolveCategorySlug(input.categoryIds),
  ]);

  if (talentResult.error) throw new AppError(500, talentResult.error.message);
  if (authResult.error) throw new AppError(500, authResult.error.message);
  if (!talentResult.data) throw new AppError(404, 'Assigned talent account not found');

  let email = (authResult.data.user?.email ?? '').trim().toLowerCase();

  // Auto-create Supabase Auth account if the talent has none yet.
  // Pull the email from their linked lead_submissions row.
  if (!email) {
    const leadEmail = await resolveEmailFromLead(input.talentUserId);
    if (!leadEmail) {
      throw new AppError(400, 'Assigned talent needs an email address for SquadHub access');
    }

    const tempPassword = generateTempPassword();
    const { data: newAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: leadEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: 'talent',
        full_name: (talentResult.data.full_name as string | null) ?? null,
        must_reset_password: true,
      },
    });
    if (createErr) {
      // 422 = user already exists (race condition) — re-fetch instead of failing
      if (createErr.message?.includes('already')) {
        const { data: retryAuth } = await supabaseAdmin.auth.admin.getUserById(input.talentUserId);
        email = (retryAuth?.user?.email ?? '').trim().toLowerCase();
        if (!email) {
          throw new AppError(400, 'Assigned talent needs an email address for SquadHub access');
        }
      } else {
        throw new AppError(500, `Failed to create auth account for talent: ${createErr.message}`);
      }
    } else {
      email = leadEmail;
      console.log(
        `[squadhub-provision] Auto-created auth account for talent ${input.talentUserId} with email ${leadEmail}`,
      );
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/integrations/squadhire/talent/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SquadHub-Signature': secret,
      },
      body: JSON.stringify({
        card_id: input.cardId,
        talent_user_id: input.talentUserId,
        email,
        name: (talentResult.data.full_name as string | null) ?? null,
        phone: (talentResult.data.phone as string | null) ?? null,
        category_slug: categorySlug,
      }),
      signal: controller.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success || !json?.data?.user_id) {
      throw new AppError(502, json?.error || `SquadHub talent provisioning failed (${res.status})`);
    }
    return {
      userId: String(json.data.user_id),
      created: json.data.created === true,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'Could not reach SquadHub to provision the assigned talent');
  } finally {
    clearTimeout(timer);
  }
}
