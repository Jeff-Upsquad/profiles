import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as leadService from '../services/lead.service.js';
import {
  applyLeadStatusToTalentUser,
  findTalentUserIdByPhone,
} from '../lib/talent-pipeline-sync.js';
import {
  LEAD_STATUS_VALUES,
  type UpdateLeadStatusInput,
} from '../validators/lead.validators.js';

// Fallback reverse mapping: CRM stage label → canonical internal status, used
// only when the admin's crm_status_mapping has no snapshot for this lead's
// pipeline (or the stage isn't in it). The primary path is a snapshot-driven,
// id-anchored reverse lookup built from crm_status_mapping (see below), which
// survives CRM stage renames. Lookup here is case-insensitive/whitespace-tolerant.
const CRM_STAGE_TO_STATUS: Record<string, (typeof LEAD_STATUS_VALUES)[number]> = {
  'new': 'new',
  'new applicants': 'new',
  'share form': 'share_form',
  'share landing page': 'share_form',
  'form filled / for review': 'form_filled',
  'applicants': 'form_filled',
  'signed up / applicants': 'form_filled',
  'shortlisted': 'shortlisted',
  'signed up': 'signed_up',
  'application approved': 'signed_up',
  'onboarding training': 'onboarding_training',
  'onboarding course': 'onboarding_training',
  'basic profile': 'basic_profile',
  'job profile': 'job_profile',
  'portfolio updation': 'portfolio_updation',
  'final review': 'final_review',
  'live': 'live',
  'no response / in active': 'no_response',
  'no response / inactive': 'no_response',
  'no response': 'no_response',
  'rejected / disqualified': 'rejected',
  'rejected': 'rejected',
  'disqualified': 'rejected',
};

function normalizeStage(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

const leadStageWebhookSchema = z.object({
  event: z.literal('stage_changed').optional(),
  external_lead_id: z.string().uuid().nullable().optional(),
  phone: z.string().optional(),
  stage_name: z.string().min(1, 'stage_name is required'),
  // Optional stable CRM stage id — when present, the reverse lookup matches on
  // it (rename-proof) instead of the stage name.
  stage_id: z.string().min(1).optional(),
  // Which board the card moved on. 'candidates' (default, the onboarding
  // funnel mapped to lead statuses) or 'talent' (the CRM's post-onboarding
  // board, mirrored verbatim onto talent_users.crm_talent_stage_*).
  pipeline_kind: z.enum(['candidates', 'talent', 'partners']).optional(),
  pipeline_name: z.string().optional(),
  timestamp: z.string().optional(),
});

type LeadRow = { id: string; form_type: string | null };

async function findLead(
  externalLeadId: string | null | undefined,
  phone: string | null | undefined,
): Promise<LeadRow | null> {
  if (externalLeadId) {
    const { data } = await supabaseAdmin
      .from('lead_submissions')
      .select('id, form_type')
      .eq('id', externalLeadId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data?.id) return data as LeadRow;
  }

  if (phone) {
    const phoneDigits = phone.replace(/\D/g, '').slice(-10);
    if (phoneDigits.length !== 10) return null;
    // Match the last 10 digits of the stored phone (CRM uses E.164, Profiles
    // stores raw — same matching strategy as check_contact_exists).
    const { data } = await supabaseAdmin
      .from('lead_submissions')
      .select('id, form_type')
      .filter(
        'phone',
        'like',
        `%${phoneDigits}`,
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0] as LeadRow;
  }

  return null;
}

async function linkedTalentForLead(leadId: string | null): Promise<string | null> {
  if (!leadId) return null;
  const { data } = await supabaseAdmin
    .from('lead_submissions')
    .select('linked_talent_user_id')
    .eq('id', leadId)
    .maybeSingle();
  return (data?.linked_talent_user_id as string | null) ?? null;
}

async function resolveInternalStatus(
  formType: string | null,
  stageName: string,
  stageId: string | undefined,
): Promise<{
  internalStatus: (typeof LEAD_STATUS_VALUES)[number] | undefined;
  validForType: ReadonlySet<string> | null;
}> {
  let internalStatus: (typeof LEAD_STATUS_VALUES)[number] | undefined;
  let validForType: ReadonlySet<string> | null = null;
  try {
    const { getAdminSetting } = await import('../services/admin.service.js');
    const { buildReverseLookup, validStatusesForFormType } = await import(
      '../services/crm-stage-mapping.js'
    );
    // Talent-only cards (landing-page / WhatsApp signup, no lead_submission)
    // still belong to the creative onboarding funnel.
    const typeForLookup = formType || 'creative';
    validForType = validStatusesForFormType(typeForLookup);
    const mapping = await getAdminSetting<any>('crm_status_mapping');
    const pipeline = mapping?.pipelines?.[typeForLookup];
    const { byId, byName } = buildReverseLookup(pipeline, { prefer: validForType });
    const hit =
      (stageId ? byId[stageId] : undefined) ?? byName[normalizeStage(stageName)];
    if (hit && (LEAD_STATUS_VALUES as readonly string[]).includes(hit)) {
      internalStatus = hit as (typeof LEAD_STATUS_VALUES)[number];
    }
  } catch (err) {
    console.error('[crm-webhook] snapshot reverse-lookup failed:', err);
  }

  if (!internalStatus) {
    internalStatus = CRM_STAGE_TO_STATUS[normalizeStage(stageName)];
  }
  return { internalStatus, validForType };
}

const messageFailedSchema = z.object({
  event: z.literal('message_failed'),
  external_lead_id: z.string().uuid().nullable().optional(),
  phone: z.string().nullable().optional(),
  template_name: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  timestamp: z.string().optional(),
});

// Plain-language reason for the Onboarding hub flag.
function messageFailureReason(code: string | null | undefined, message: string | null | undefined): string {
  if (code === 'outside_24h_window') return '24-hour WhatsApp window closed';
  if (code === 'whatsapp_not_configured') return 'WhatsApp is not configured in the CRM';
  const m = (message ?? '').trim();
  return (m || 'WhatsApp send failed').slice(0, 300);
}

/** CRM says a WhatsApp message to this person failed — flag the talent. */
async function handleMessageFailed(body: unknown, res: Response): Promise<void> {
  const parsed = messageFailedSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
  }
  const { external_lead_id, phone, template_name, error_code, error_message } = parsed.data;
  const lead = await findLead(external_lead_id ?? null, phone ?? null);
  const talentUserId =
    (await linkedTalentForLead(lead?.id ?? null)) ?? (await findTalentUserIdByPhone(phone ?? null));
  if (!talentUserId) {
    res.json({ ok: true, skipped: 'talent_not_found' });
    return;
  }
  const reason = messageFailureReason(error_code, error_message);
  const { error } = await supabaseAdmin
    .from('talent_users')
    .update({
      crm_message_failed_at: new Date().toISOString(),
      crm_message_failed_template: template_name ?? null,
      crm_message_failed_reason: reason,
    })
    .eq('id', talentUserId);
  if (error) throw new AppError(500, error.message);
  await supabaseAdmin
    .from('automation_events')
    .insert({
      event_type: 'crm_message_failed',
      lead_id: lead?.id ?? null,
      talent_user_id: talentUserId,
      triggered_by: 'system',
      metadata: { template_name: template_name ?? null, error_code: error_code ?? null, error_message: error_message ?? null },
    })
    .then(
      () => {},
      () => {},
    );
  res.json({ ok: true, talentUserId, flagged: true });
}

/** A candidates board that belongs to the Jobs program (any jobs / jobs_<category> mapping). */
async function isJobsCandidatesBoard(pipelineName: string | null): Promise<boolean> {
  const name = normalizeStage(pipelineName ?? '');
  if (!name) return false;
  if (name === 'jobs candidates') return true;
  const { getAdminSetting } = await import('../services/admin.service.js');
  const { isJobsKey } = await import('../services/linked-tracks.service.js');
  const mapping = await getAdminSetting<{ pipelines?: Record<string, { pipeline_name?: string }> }>('crm_status_mapping');
  return Object.entries(mapping?.pipelines ?? {}).some(([key, cfg]) =>
    isJobsKey(key) && normalizeStage(cfg?.pipeline_name ?? '') === name);
}

/** An operator moved the Partner Program card — a linked Jobs pipeline follows silently. */
async function mirrorPartnerStatus(talentUserId: string | null, leadStatus: string) {
  if (!talentUserId) return;
  const { leadStatusToPipelineStage } = await import('../lib/pipelineStageMapping.js');
  const { mirrorCandidateStage } = await import('../services/linked-tracks.service.js');
  await mirrorCandidateStage(talentUserId, 'partner', leadStatusToPipelineStage(leadStatus))
    .catch((err) => console.error('[crm-webhook] linked-track mirror failed:', err));
}

export async function handleLeadStageChanged(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // The CRM posts every event to this one URL; message failures aren't
    // stage moves.
    if ((req.body as { event?: unknown } | null)?.event === 'message_failed') {
      await handleMessageFailed(req.body, res);
      return;
    }
    const parsed = leadStageWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { external_lead_id, phone, stage_name, stage_id, pipeline_kind, pipeline_name } =
      parsed.data;

    const lead = await findLead(external_lead_id ?? null, phone ?? null);

    if (pipeline_kind === 'candidates' && (await isJobsCandidatesBoard(pipeline_name ?? null))) {
      const talentUserId = (await linkedTalentForLead(lead?.id ?? null)) ??
        (await findTalentUserIdByPhone(phone ?? null));
      if (!talentUserId) { res.json({ ok: true, skipped: 'talent_not_found' }); return; }
      const stageByName: Record<string, string> = {
        applicants: 'applicants',
        'signed up / applicants': 'applicants',
        'application approved': 'application_approved',
        'onboarding training': 'onboarding_course',
        'basic profile': 'basic_profile',
        'job profile': 'job_profile',
        'final review': 'final_review',
        live: 'live',
        'rejected / disqualified': 'rejected',
      };
      const stage = stageByName[normalizeStage(stage_name)];
      if (!stage) { res.json({ ok: true, skipped: 'pre_signup_or_unmapped_stage' }); return; }
      const { error } = await supabaseAdmin.from('talent_users')
        .update({ jobs_pipeline_stage: stage })
        .eq('id', talentUserId).eq('wants_jobs', true);
      if (error) throw new AppError(500, error.message);
      if (stage !== 'live') {
        const { clearTalentStage } = await import('../services/onboarding-hub.service.js');
        await clearTalentStage(talentUserId, 'jobs').catch(() => {});
      }
      // Applied together → the Partner Program pipeline follows (and messages).
      const { mirrorCandidateStage } = await import('../services/linked-tracks.service.js');
      await mirrorCandidateStage(talentUserId, 'jobs', stage);
      res.json({ ok: true, talentUserId, pipeline_stage: stage });
      return;
    }

    // Talent-pipeline moves aren't mapped to lead statuses at all — the CRM
    // owns those stage names. Resolve the talent account (via the lead link,
    // else by phone) and mirror the stage as-is.
    if (pipeline_kind === 'talent') {
      const talentUserId =
        (await linkedTalentForLead(lead?.id ?? null)) ??
        (await findTalentUserIdByPhone(phone ?? null));
      if (!talentUserId) {
        res.json({ ok: true, skipped: 'talent_not_found', stage_name });
        return;
      }
      const { applyInboundTalentStage } = await import('../services/onboarding-hub.service.js');
      await applyInboundTalentStage(talentUserId, {
        pipeline_name: pipeline_name ?? null,
        stage_id: stage_id ?? null,
        stage_name,
      });
      await supabaseAdmin
        .from('automation_events')
        .insert({
          event_type: 'crm_talent_stage_received',
          lead_id: lead?.id ?? null,
          talent_user_id: talentUserId,
          triggered_by: 'system',
          metadata: { pipeline_name: pipeline_name ?? null, stage_name, stage_id: stage_id ?? null },
        })
        .then(
          () => {},
          () => {},
        );
      res.json({ ok: true, talentUserId, talent_stage: stage_name });
      return;
    }

    if (pipeline_kind === 'partners') {
      // Partner boards aren't mirrored anywhere in Profiles yet.
      res.json({ ok: true, skipped: 'unsupported_pipeline_kind', pipeline_kind });
      return;
    }

    // Candidate boards may also be secondary memberships. Preserve the other
    // track's post-live stage rather than clearing it on every candidate move.
    {
      const talentUserId =
        (await linkedTalentForLead(lead?.id ?? null)) ??
        (await findTalentUserIdByPhone(phone ?? null));
      if (talentUserId) {
        const { clearTalentStage } = await import('../services/onboarding-hub.service.js');
        await clearTalentStage(talentUserId).catch(() => {});
      }
    }

    const { internalStatus, validForType } = await resolveInternalStatus(
      lead?.form_type ?? null,
      stage_name,
      stage_id,
    );

    if (!internalStatus) {
      // Stage isn't in the synced pipeline (e.g. a custom CRM column). Ack
      // with 200 so the CRM doesn't retry, but mark it as skipped.
      res.json({ ok: true, skipped: 'unmapped_stage', stage_name });
      return;
    }

    if (lead) {
      // Safety net for the duplicate-stage-id defect: never let an inbound CRM
      // stage move a lead to a status outside its pipeline's vocabulary. This is
      // what once translated CRM "Live" → `onboard_completed` for creative leads,
      // silently flipping live talents inactive. Ack 200 (no CRM retry) but skip.
      if (validForType && !validForType.has(internalStatus)) {
        console.warn(
          `[crm-webhook] blocked cross-pipeline status "${internalStatus}" for ` +
            `${lead.form_type} lead ${lead.id} (CRM stage "${stage_name}")`,
        );
        await supabaseAdmin
          .from('automation_events')
          .insert({
            event_type: 'crm_status_sync_blocked',
            lead_id: lead.id,
            triggered_by: 'system',
            metadata: {
              form_type: lead.form_type,
              stage_name,
              stage_id: stage_id ?? null,
              resolved: internalStatus,
            },
          })
          .then(
            () => {},
            () => {},
          );
        res.json({ ok: true, skipped: 'cross_pipeline_status', resolved: internalStatus });
        return;
      }

      const input: UpdateLeadStatusInput = { status: internalStatus };
      await leadService.updateLeadStatus(lead.id, input, null, { source: 'crm_webhook' });
      await mirrorPartnerStatus(
        (await linkedTalentForLead(lead.id)) ?? (await findTalentUserIdByPhone(phone ?? null)),
        internalStatus,
      );
      res.json({ ok: true, leadId: lead.id, status: internalStatus });
      return;
    }

    // No lead_submission — still sync Sign-ups if this phone has a talent account
    // (WhatsApp CRM cards that signed up without filling the apply form).
    const talentUserId = await findTalentUserIdByPhone(phone ?? null);
    if (!talentUserId) {
      res.json({ ok: true, skipped: 'lead_not_found' });
      return;
    }

    const pipelineStage = await applyLeadStatusToTalentUser(talentUserId, internalStatus);
    if (pipelineStage) await mirrorPartnerStatus(talentUserId, internalStatus);
    if (!pipelineStage) {
      res.json({
        ok: true,
        skipped: 'unmapped_signup_stage',
        status: internalStatus,
        talentUserId,
      });
      return;
    }

    await supabaseAdmin
      .from('automation_events')
      .insert({
        event_type: 'crm_talent_stage_sync',
        talent_user_id: talentUserId,
        triggered_by: 'system',
        metadata: {
          stage_name,
          stage_id: stage_id ?? null,
          status: internalStatus,
          pipeline_stage: pipelineStage,
        },
      })
      .then(
        () => {},
        () => {},
      );

    res.json({
      ok: true,
      talentUserId,
      status: internalStatus,
      pipeline_stage: pipelineStage,
    });
  } catch (err) {
    next(err);
  }
}
