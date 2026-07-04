import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as leadService from '../services/lead.service.js';
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
  'basic profile': 'basic_profile',
  'job profile': 'job_profile',
  'portfolio updation': 'portfolio_updation',
  'final review': 'final_review',
  'live': 'live',
  'no response / in active': 'no_response',
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
    if (!lead) {
      res.json({ ok: true, skipped: 'lead_not_found' });
      return;
    }

    // Primary path: reverse-map via the admin's crm_status_mapping snapshot for
    // this lead's pipeline. Matching by stage id (when the CRM sends it) is
    // rename-proof; matching by the current stage name works after a refresh.
    let internalStatus: (typeof LEAD_STATUS_VALUES)[number] | undefined;
    try {
      const { getAdminSetting } = await import('../services/admin.service.js');
      const { buildReverseLookup } = await import('../services/crm-stage-mapping.js');
      const mapping = await getAdminSetting<any>('crm_status_mapping');
      const pipeline = lead.form_type ? mapping?.pipelines?.[lead.form_type] : undefined;
      const { byId, byName } = buildReverseLookup(pipeline);
      const hit =
        (stage_id ? byId[stage_id] : undefined) ?? byName[normalizeStage(stage_name)];
      if (hit && (LEAD_STATUS_VALUES as readonly string[]).includes(hit)) {
        internalStatus = hit as (typeof LEAD_STATUS_VALUES)[number];
      }
    } catch (err) {
      console.error('[crm-webhook] snapshot reverse-lookup failed:', err);
    }

    // Fallback: global hardcoded name table (unconfigured pipeline / no snapshot).
    if (!internalStatus) {
      internalStatus = CRM_STAGE_TO_STATUS[normalizeStage(stage_name)];
    }

    if (!internalStatus) {
      // Stage isn't in the synced pipeline (e.g. a custom CRM column). Ack
      // with 200 so the CRM doesn't retry, but mark it as skipped.
      res.json({ ok: true, skipped: 'unmapped_stage', stage_name });
      return;
    }

    const input: UpdateLeadStatusInput = { status: internalStatus };
    await leadService.updateLeadStatus(lead.id, input, null, { source: 'crm_webhook' });

    res.json({ ok: true, leadId: lead.id, status: internalStatus });
  } catch (err) {
    next(err);
  }
}
