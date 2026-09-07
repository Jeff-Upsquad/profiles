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
  'share form': 'share_form',
  'form filled / for review': 'form_filled',
  'shortlisted': 'shortlisted',
  'signed up': 'signed_up',
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

export async function handleLeadStageChanged(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = leadStageWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { external_lead_id, phone, stage_name, stage_id } = parsed.data;

    const lead = await findLead(external_lead_id ?? null, phone ?? null);
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
