import { supabaseAdmin } from '../config/supabase.js';
import {
  isLinked, JOBS_STAGE_ORDER, type Track, type TrackState,
} from '../lib/linked-tracks.js';

export * from '../lib/linked-tracks.js';

/**
 * Jobs + Partner Program for one talent.
 *
 * Applied together at signup (`tracks_linked`): one application — both
 * pipelines move together, and the Partner Program card carries the WhatsApp
 * messages while the Jobs card follows silently, so each stage messages once.
 *
 * Second track added later: its own pipeline, starting from the beginning.
 * Steps already finished (basic profile, job profile, portfolio are shared)
 * are caught up one stage at a time, paced by CATCH_UP_GAP_MS.
 *
 * Rejection is never mirrored — each track keeps its own decision.
 */

const SWEEP_INTERVAL_MS = 15 * 60_000;

const TRACK_STATE_COLUMNS =
  'id, full_name, phone, tracks_linked, wants_jobs, partner_approval_status, pipeline_stage, ' +
  'jobs_pipeline_stage, partner_stage_changed_at, jobs_stage_changed_at';

export async function loadTrackState(talentUserId: string): Promise<TrackState | null> {
  const { data } = await supabaseAdmin
    .from('talent_users')
    .select(TRACK_STATE_COLUMNS)
    .eq('id', talentUserId)
    .maybeSingle();
  return (data as unknown as TrackState | null) ?? null;
}

/**
 * Mapping key for the talent's Jobs board: `jobs_<category>` when that board
 * is linked in CRM Mapping, else the shared `jobs` board.
 */
export async function jobsPipelineKey(
  talentUserId: string,
  configured: Record<string, unknown> | null | undefined,
): Promise<string> {
  const keys = configured ?? {};
  try {
    const { formTypesForTalent } = await import('../lib/signup-category.js');
    const types = await formTypesForTalent(talentUserId);
    const hit = types.find((ft) => ft !== 'jobs' && keys[`jobs_${ft}`]);
    if (hit) return `jobs_${hit}`;
  } catch (err) {
    console.error('[linked-tracks] category lookup failed:', err);
  }
  return 'jobs';
}

/**
 * A linked talent's candidate stage moved on one track — move the other track
 * to the same stage. Partner pushes go through the candidate lead(s) so the
 * Partner Program card (and its automations) moves; Jobs pushes are silent.
 * No-op when not linked, when the other track is already there, or for
 * rejection. Safe to call after any stage write.
 */
export async function mirrorCandidateStage(
  talentUserId: string,
  fromTrack: Track,
  stage: string | null | undefined,
  opts: { silent?: boolean; forwardOnly?: boolean } = {},
): Promise<void> {
  if (!stage || stage === 'rejected') return;
  const t = await loadTrackState(talentUserId);
  if (!t || !isLinked(t)) return;
  const other: Track = fromTrack === 'jobs' ? 'partner' : 'jobs';
  const current = other === 'jobs' ? t.jobs_pipeline_stage : t.pipeline_stage;
  if (current === stage) return;
  // Automatic progress never drags the other track back (an admin move does).
  if (opts.forwardOnly && JOBS_STAGE_ORDER.indexOf(current ?? '') >= JOBS_STAGE_ORDER.indexOf(stage)) return;

  const { error } = await supabaseAdmin
    .from('talent_users')
    .update(other === 'jobs' ? { jobs_pipeline_stage: stage } : { pipeline_stage: stage })
    .eq('id', talentUserId);
  if (error) {
    console.error('[linked-tracks] mirror update failed:', error.message);
    return;
  }
  if (stage !== 'live') {
    const { clearTalentStage } = await import('./onboarding-hub.service.js');
    await clearTalentStage(talentUserId, other).catch(() => {});
  }

  await pushCandidateStage(t, other, stage, { silent: other === 'jobs' || !!opts.silent });
}

/** Push one track's candidate stage to the CRM. */
export async function pushCandidateStage(
  t: TrackState,
  track: Track,
  stage: string,
  opts: { silent?: boolean } = {},
): Promise<void> {
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(t.id);
  const email = authUser?.user?.email ?? null;
  const { notifyCrmPipelineStageChanged, onLeadStatusChanged, orderedStagesForFormType } =
    await import('./automation.service.js');

  if (track === 'jobs') {
    await notifyCrmPipelineStageChanged({
      talentUserId: t.id, name: t.full_name ?? '', email, phone: t.phone ?? null,
      newStage: stage, formType: 'jobs', silent: !!opts.silent,
    }).catch((err) => console.error('[linked-tracks] jobs push failed:', err));
    return;
  }

  // Partner: move the candidate lead(s) — their CRM card follows per form_type.
  const { pipelineStageToLeadStatus } = await import('../lib/pipelineStageMapping.js');
  const leadStatus = pipelineStageToLeadStatus(stage);
  let moved = false;
  if (leadStatus) {
    const { data: leads } = await supabaseAdmin
      .from('lead_submissions')
      .select('id, form_type, status')
      .eq('linked_talent_user_id', t.id)
      .is('deleted_at', null)
      .neq('status', 'archived');
    for (const lead of (leads ?? []) as Array<{ id: string; form_type: string | null; status: string }>) {
      if (lead.form_type === 'jobs') continue;
      if (!orderedStagesForFormType(lead.form_type).includes(leadStatus)) continue;
      moved = true;
      if (lead.status === leadStatus) continue;
      const { error } = await supabaseAdmin
        .from('lead_submissions')
        .update({ status: leadStatus, status_changed_at: new Date().toISOString() })
        .eq('id', lead.id);
      if (error) {
        console.error('[linked-tracks] partner lead move failed:', error.message);
        continue;
      }
      await onLeadStatusChanged(lead.id, leadStatus, null, { silent: !!opts.silent })
        .catch((err) => console.error('[linked-tracks] partner push failed:', err));
    }
  }
  if (!moved) {
    await notifyCrmPipelineStageChanged({
      talentUserId: t.id, name: t.full_name ?? '', email, phone: t.phone ?? null,
      newStage: stage, silent: !!opts.silent,
    }).catch((err) => console.error('[linked-tracks] partner card push failed:', err));
  }
}

/**
 * Catching-up tracks advance one stage per CATCH_UP_GAP_MS. Talent activity
 * also triggers syncOnboardingStage; this sweep keeps the pace going when the
 * talent has nothing left to do.
 */
export async function sweepCatchUpTracks(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('id')
    .eq('tracks_linked', false)
    .eq('wants_jobs', true)
    .eq('partner_approval_status', 'approved')
    .neq('jobs_pipeline_stage', 'rejected')
    .neq('pipeline_stage', 'rejected')
    .not('suspended', 'is', true)
    .not('blacklisted', 'is', true)
    .is('application_cancelled_at', null);
  if (error) throw new Error(error.message);
  const { syncOnboardingStage } = await import('./automation.service.js');
  let n = 0;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    try {
      await syncOnboardingStage(row.id);
      n += 1;
    } catch (err) {
      console.error('[linked-tracks] catch-up sync failed:', err);
    }
  }
  return n;
}

export function startTrackCatchUpSweeper(): NodeJS.Timeout {
  const tick = async () => {
    try {
      await sweepCatchUpTracks();
    } catch (e) {
      console.error('[track catch-up sweeper] tick failed:', (e as Error).message);
    }
  };
  const handle = setInterval(tick, SWEEP_INTERVAL_MS);
  setTimeout(tick, 60_000);
  return handle;
}

/**
 * One-time alignment for a linked talent (backfill): both tracks on the
 * further-along candidate stage, the talent's own Jobs card opened on their
 * Jobs board, and — once Live — the Jobs talent-board card on the Partner
 * card's stage. Every CRM move here is silent: the Partner card already sent
 * these messages. Returns what it did, for the log.
 */
export async function resyncLinkedTalent(talentUserId: string, opts: { dryRun?: boolean } = {}): Promise<string> {
  const t = await loadTrackState(talentUserId);
  if (!t || !isLinked(t)) return 'skip: not linked';
  const rank = (s: string | null) => JOBS_STAGE_ORDER.indexOf(s === 'signed_up' ? 'application_approved' : s ?? '');
  const stage = rank(t.jobs_pipeline_stage) >= rank(t.pipeline_stage) ? t.jobs_pipeline_stage : t.pipeline_stage;
  if (!stage || rank(stage) === -1) return `skip: unranked stages ${t.pipeline_stage}/${t.jobs_pipeline_stage}`;

  const { data: board } = await supabaseAdmin
    .from('talent_users')
    .select('crm_talent_stage_name')
    .eq('id', talentUserId)
    .maybeSingle();
  const partnerBoardStage = (board as { crm_talent_stage_name?: string | null } | null)?.crm_talent_stage_name ?? null;
  const summary = `stage ${t.pipeline_stage}/${t.jobs_pipeline_stage} → ${stage}` +
    (stage === 'live' && partnerBoardStage ? `, talent board → ${partnerBoardStage}` : '');
  if (opts.dryRun) return `dry-run: ${summary}`;

  const { error } = await supabaseAdmin
    .from('talent_users')
    .update({ pipeline_stage: stage, jobs_pipeline_stage: stage })
    .eq('id', talentUserId);
  if (error) return `error: ${error.message}`;
  const fresh = { ...t, pipeline_stage: stage, jobs_pipeline_stage: stage };
  await pushCandidateStage(fresh, 'partner', stage, { silent: true });
  await pushCandidateStage(fresh, 'jobs', stage, { silent: true });

  if (stage === 'live' && partnerBoardStage) {
    // Let the Jobs card's own (silent) arrival on its talent board echo back
    // first, then place it on the Partner card's stage.
    await new Promise((r) => setTimeout(r, 2_000));
    const hub = await import('./onboarding-hub.service.js');
    const pipelines = await hub.getTalentPipelineConfig();
    const key = await jobsPipelineKey(talentUserId, pipelines);
    const cfg = pipelines[key];
    const target = cfg?.stages.find((s) => s.name.trim().toLowerCase() === partnerBoardStage.trim().toLowerCase());
    if (cfg && target) {
      await hub.applyInboundTalentStage(talentUserId, {
        pipeline_name: cfg.pipeline_name, stage_id: target.id, stage_name: target.name,
      }, { mirror: false });
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(talentUserId);
      const { notifyCrmTalentStageChanged } = await import('./automation.service.js');
      await notifyCrmTalentStageChanged({
        talentUserId, adminUserId: null, name: t.full_name ?? '', email: authUser?.user?.email ?? null,
        phone: t.phone ?? null, pipelineName: cfg.pipeline_name, stageId: target.id, stageName: target.name,
        silent: true,
      });
    }
  }
  return summary;
}
