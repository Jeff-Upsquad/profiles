import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Hiring-card ingest hook. Hiring cards ride the existing subscription-card
 * ingest (card_type='hiring'); this module upserts the jobs-side satellites:
 *
 *  - job_profiles: canonical job-profile snapshot, keyed by SquadHub's
 *    job-profile id (content.job_profile.external_id — REQUIRED, 400 without
 *    it per the cross-repo contract). Q&A anchors here so it survives card
 *    re-publishes and fresh broadcasts.
 *  - job_cards: 1:1 hiring satellite of the subscription_cards row (stage,
 *    openings). hiring_stage is NOT touched on re-ingest — a content edit on
 *    SquadHub must not reset a card that's already screening/interviewing.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function extractJobProfileExternalId(content: Record<string, unknown> | undefined): string | null {
  const jp = asRecord(content?.job_profile);
  const externalId = jp?.external_id;
  return typeof externalId === 'string' && externalId.length > 0 ? externalId : null;
}

/**
 * Validate a hiring payload BEFORE any card write, so a malformed publish is
 * rejected whole instead of leaving a card without its job satellites.
 */
export function assertHiringContentValid(content: Record<string, unknown> | undefined): void {
  if (!extractJobProfileExternalId(content)) {
    throw new AppError(400, 'Hiring card content.job_profile.external_id is required');
  }
}

export interface SyncJobEntitiesInput {
  content: Record<string, unknown>;
  business_user_id: string | null;
}

export async function syncJobEntitiesForCard(
  cardId: string,
  input: SyncJobEntitiesInput,
): Promise<{ job_profile_id: string }> {
  const content = input.content ?? {};
  const jp = asRecord(content.job_profile);
  const externalId = extractJobProfileExternalId(content);
  if (!jp || !externalId) {
    throw new AppError(400, 'Hiring card content.job_profile.external_id is required');
  }

  const title =
    (typeof jp.title === 'string' && jp.title.trim()) ||
    (typeof content.title === 'string' && content.title.trim()) ||
    'Untitled role';

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('job_profiles')
    .upsert(
      {
        external_id: externalId,
        title,
        description: typeof jp.description === 'string' ? jp.description : null,
        details: jp,
        business_snapshot: asRecord(content.business_profile) ?? {},
        brand_snapshot: asRecord(content.brand_profile) ?? {},
        business_user_id: input.business_user_id,
        status: 'active',
      },
      { onConflict: 'external_id' },
    )
    .select('id')
    .single();
  if (profErr || !profile) {
    throw new AppError(500, profErr?.message ?? 'Failed to upsert job profile');
  }

  const openingsRaw = Number(
    (content as Record<string, unknown>).openings_count ??
      (content as Record<string, unknown>).openings ??
      1,
  );
  const openings = Number.isFinite(openingsRaw) && openingsRaw >= 1 ? Math.floor(openingsRaw) : 1;

  // Upsert only the ingest-owned columns; hiring_stage / screening_started_at
  // / closed_at stay untouched on conflict so a re-publish never resets the
  // funnel state.
  const { error: cardErr } = await supabaseAdmin
    .from('job_cards')
    .upsert(
      {
        card_id: cardId,
        job_profile_id: profile.id as string,
        openings,
      },
      { onConflict: 'card_id' },
    );
  if (cardErr) {
    throw new AppError(500, `Failed to upsert job card satellite: ${cardErr.message}`);
  }

  return { job_profile_id: profile.id as string };
}
