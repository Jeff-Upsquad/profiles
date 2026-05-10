import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as leadService from '../services/lead.service.js';
import {
  LEAD_STATUS_VALUES,
  type UpdateLeadStatusInput,
} from '../validators/lead.validators.js';

// Reverse mapping: CRM stage label → canonical internal status. The forward
// mapping (in admin_settings.crm_status_mapping) has many-to-one collapses
// (e.g. both `form_filled` and `under_review` → "Form Filled / For Review");
// for the reverse we pick the canonical value the CRM should drive cards back
// to. Lookup is case-insensitive and whitespace-tolerant.
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
  timestamp: z.string().optional(),
});

async function findLeadId(
  externalLeadId: string | null | undefined,
  phone: string | null | undefined,
): Promise<string | null> {
  if (externalLeadId) {
    const { data } = await supabaseAdmin
      .from('lead_submissions')
      .select('id')
      .eq('id', externalLeadId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (phone) {
    const phoneDigits = phone.replace(/\D/g, '').slice(-10);
    if (phoneDigits.length !== 10) return null;
    // Match the last 10 digits of the stored phone (CRM uses E.164, Profiles
    // stores raw — same matching strategy as check_contact_exists).
    const { data } = await supabaseAdmin
      .from('lead_submissions')
      .select('id')
      .filter(
        'phone',
        'like',
        `%${phoneDigits}`,
      )
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0].id;
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
    const { external_lead_id, phone, stage_name } = parsed.data;

    const internalStatus = CRM_STAGE_TO_STATUS[normalizeStage(stage_name)];
    if (!internalStatus) {
      // Stage isn't in the synced pipeline (e.g. a custom CRM column). Ack
      // with 200 so the CRM doesn't retry, but mark it as skipped.
      res.json({ ok: true, skipped: 'unmapped_stage', stage_name });
      return;
    }

    const leadId = await findLeadId(external_lead_id ?? null, phone ?? null);
    if (!leadId) {
      res.json({ ok: true, skipped: 'lead_not_found' });
      return;
    }

    const input: UpdateLeadStatusInput = { status: internalStatus };
    await leadService.updateLeadStatus(leadId, input, null, { source: 'crm_webhook' });

    res.json({ ok: true, leadId, status: internalStatus });
  } catch (err) {
    next(err);
  }
}
