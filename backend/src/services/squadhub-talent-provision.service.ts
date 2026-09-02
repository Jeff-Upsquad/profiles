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
 * Create or reconcile the SquadHub partner account for an activated talent.
 * The endpoint is idempotent and independently verifies that this talent is
 * assigned to this card on SquadHub before creating anything.
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

  const email = (authResult.data.user?.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new AppError(400, 'Assigned talent needs an email address for SquadHub access');
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
