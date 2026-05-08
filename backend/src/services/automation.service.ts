import { supabaseAdmin } from '../config/supabase.js';
import { getAdminSetting } from './admin.service.js';
import { checkInvitation } from './invite.service.js';

const CRM_TIMEOUT_MS = 5_000;

interface AutomationConfig {
  auto_shortlist_on_approve: boolean;
  auto_onboarding_on_signup: boolean;
  auto_invite_on_shortlist: boolean;
}

interface TemplateConfig {
  enabled: boolean;
  channel: string;
  template_name: string;
  template_body: string;
  crm_webhook_url: string;
  pipeline_stage?: string;
}

type TemplatesMap = Record<string, TemplateConfig>;

const DEFAULT_CONFIG: AutomationConfig = {
  auto_shortlist_on_approve: true,
  auto_onboarding_on_signup: true,
  auto_invite_on_shortlist: true,
};

// ---------------------------------------------------------------------------
// Event log
// ---------------------------------------------------------------------------

async function logEvent(event: {
  event_type: string;
  lead_id?: string;
  talent_user_id?: string;
  triggered_by: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from('automation_events').insert({
      event_type: event.event_type,
      lead_id: event.lead_id ?? null,
      talent_user_id: event.talent_user_id ?? null,
      triggered_by: event.triggered_by,
      metadata: event.metadata ?? {},
    });
  } catch (err) {
    console.error('[automation] logEvent failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

async function getConfig(): Promise<AutomationConfig> {
  const cfg = await getAdminSetting<AutomationConfig>('automation_config');
  return cfg ?? DEFAULT_CONFIG;
}

async function getTemplates(): Promise<TemplatesMap> {
  const tpl = await getAdminSetting<TemplatesMap>('automation_templates');
  return tpl ?? {};
}

// ---------------------------------------------------------------------------
// CRM webhook
// ---------------------------------------------------------------------------

async function sendCrmWebhook(
  webhookUrl: string,
  payload: object,
): Promise<{ sent: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Shared-secret auth for the SquadHire CRM inbound endpoint. The CRM
    // verifies this header before accepting the lead-event payload. Optional
    // for other webhook receivers — if no secret is set, the header is just
    // omitted.
    if (process.env.SQUADHIRE_CRM_INBOUND_SECRET) {
      headers['X-SquadHire-Admin-Signature'] = process.env.SQUADHIRE_CRM_INBOUND_SECRET;
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const msg = `http_${res.status}`;
      console.warn(`[automation] CRM webhook ${msg} from ${webhookUrl}`);
      return { sent: false, error: msg };
    }
    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[automation] CRM webhook failed: ${msg.slice(0, 300)}`);
    return { sent: false, error: msg.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

function interpolateTemplate(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function sendCrmTemplateMessage(
  leadId: string,
  eventType: string,
  leadData: {
    name: string;
    email: string;
    phone: string;
    profile_type?: string | null;
    form_type?: string | null;
  },
) {
  const templates = await getTemplates();
  const tpl = templates[eventType];
  if (!tpl?.enabled) return;

  const firstName = leadData.name.split(' ')[0] || leadData.name;
  const vars: Record<string, string> = {
    name: leadData.name,
    first_name: firstName,
    tier: leadData.profile_type ?? '',
    signup_url: 'https://squadhire.upsquadconnect.com/signup/talent',
  };
  const interpolated = interpolateTemplate(tpl.template_body, vars);

  const payload = {
    event: eventType,
    lead: {
      id: leadId,
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      profile_type: leadData.profile_type ?? null,
      form_type: leadData.form_type ?? null,
    },
    template: {
      name: tpl.template_name,
      body: interpolated,
      channel: tpl.channel,
    },
    pipeline_stage: tpl.pipeline_stage ?? null,
    timestamp: new Date().toISOString(),
  };

  if (tpl.crm_webhook_url) {
    const result = await sendCrmWebhook(tpl.crm_webhook_url, payload);
    await logEvent({
      event_type: result.sent ? 'crm_message_sent' : 'crm_message_failed',
      lead_id: leadId,
      triggered_by: 'system',
      metadata: { template_name: tpl.template_name, channel: tpl.channel, error: result.error },
    });
  } else {
    await logEvent({
      event_type: 'crm_message_queued',
      lead_id: leadId,
      triggered_by: 'system',
      metadata: { template_name: tpl.template_name, channel: tpl.channel, body: interpolated },
    });
  }
}

// ---------------------------------------------------------------------------
// Public event handlers
// ---------------------------------------------------------------------------

export async function onLeadReceived(
  leadId: string,
  formType: string,
  leadData: { name: string; email: string; phone: string },
) {
  // Fires for every new lead, regardless of form_type. The CRM uses the
  // payload (name/email/phone + form_type + pipeline_stage) to create or
  // update the contact record.
  await sendCrmTemplateMessage(leadId, 'lead_received', {
    ...leadData,
    form_type: formType,
  });
}

export async function onLeadAutoApproved(leadId: string, leadEmail: string) {
  const cfg = await getConfig();
  if (!cfg.auto_shortlist_on_approve) return;

  const { data: lead } = await supabaseAdmin
    .from('lead_submissions')
    .select('status')
    .eq('id', leadId)
    .single();

  if (!lead || lead.status !== 'new') return;

  await supabaseAdmin
    .from('lead_submissions')
    .update({
      status: 'shortlisted',
      status_changed_by: null,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  await logEvent({
    event_type: 'lead_auto_shortlisted',
    lead_id: leadId,
    triggered_by: 'system',
  });

  await onLeadShortlisted(leadId, null);
}

export async function onLeadShortlisted(leadId: string, adminUserId: string | null) {
  const cfg = await getConfig();

  const { data: lead } = await supabaseAdmin
    .from('lead_submissions')
    .select('email, name, phone, profile_type, form_type')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  if (cfg.auto_invite_on_shortlist && lead.email) {
    const existing = await checkInvitation(lead.email, 'talent');
    if (!existing) {
      try {
        await supabaseAdmin.from('invitations').insert({
          email: lead.email.toLowerCase(),
          role: 'talent',
          status: 'pending',
          invited_by: adminUserId ?? null,
        });
        await logEvent({
          event_type: 'shortlist_invite_sent',
          lead_id: leadId,
          triggered_by: adminUserId ? `admin:${adminUserId}` : 'system',
        });
      } catch (err) {
        console.error('[automation] invitation creation failed:', err);
      }
    }
  }

  await sendCrmTemplateMessage(leadId, 'shortlisted', {
    name: lead.name,
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    profile_type: lead.profile_type,
    form_type: lead.form_type,
  });
}

export async function onCandidateSignedUp(
  userId: string,
  email: string,
  phone: string | null,
) {
  const cfg = await getConfig();
  if (!cfg.auto_onboarding_on_signup) return;

  const { data: leads } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, status, name, email, phone, profile_type, form_type')
    .eq('linked_talent_user_id', userId);

  if (!leads || leads.length === 0) return;

  const eligible = ['new', 'under_review', 'shortlisted'];

  for (const lead of leads) {
    if (eligible.includes(lead.status)) {
      await supabaseAdmin
        .from('lead_submissions')
        .update({
          status: 'partner_onboarding',
          status_changed_by: null,
          status_changed_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      await logEvent({
        event_type: 'lead_signup_onboarding',
        lead_id: lead.id,
        talent_user_id: userId,
        triggered_by: 'system',
      });
    }

    // Always fire the CRM signed_up event for linked leads, regardless of
    // status — the signup itself is the trigger, not the status transition.
    await sendCrmTemplateMessage(lead.id, 'signed_up', {
      name: lead.name,
      email: lead.email ?? email ?? '',
      phone: lead.phone ?? phone ?? '',
      profile_type: lead.profile_type,
      form_type: lead.form_type,
    });
  }
}

// ---------------------------------------------------------------------------
// Generic status-change CRM webhook (uses crm_status_mapping config)
// ---------------------------------------------------------------------------

interface CrmStatusMapping {
  pipeline_name: string;
  form_types: string[];
  crm_webhook_url: string;
  mappings: Record<string, string>;
}

async function getCrmStatusMapping(): Promise<CrmStatusMapping | null> {
  return getAdminSetting<CrmStatusMapping>('crm_status_mapping');
}

export async function onLeadStatusChanged(
  leadId: string,
  newStatus: string,
  adminUserId: string | null,
) {
  const mapping = await getCrmStatusMapping();
  if (!mapping || !mapping.crm_webhook_url) return;

  const { data: lead } = await supabaseAdmin
    .from('lead_submissions')
    .select('email, name, phone, profile_type, form_type')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  if (mapping.form_types.length > 0 && !mapping.form_types.includes(lead.form_type)) {
    return;
  }

  const crmStage = mapping.mappings[newStatus];
  if (!crmStage) return;

  const payload = {
    event: 'status_changed',
    lead: {
      id: leadId,
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      profile_type: lead.profile_type ?? null,
      form_type: lead.form_type ?? null,
    },
    pipeline_stage: crmStage,
    status: newStatus,
    timestamp: new Date().toISOString(),
  };

  const result = await sendCrmWebhook(mapping.crm_webhook_url, payload);
  await logEvent({
    event_type: result.sent ? 'crm_status_sync_sent' : 'crm_status_sync_failed',
    lead_id: leadId,
    triggered_by: adminUserId ? `admin:${adminUserId}` : 'system',
    metadata: { pipeline_stage: crmStage, status: newStatus, error: result.error },
  });
}

// ---------------------------------------------------------------------------
// Backfill: push existing leads (all form types) to CRM with their current stage
// ---------------------------------------------------------------------------

export async function syncLeadsToCrm(
  adminUserId: string,
): Promise<{ total: number; sent: number; skipped: number; failed: number }> {
  const templates = await getTemplates();
  const receivedTpl = templates['lead_received'];
  const shortlistedTpl = templates['shortlisted'];
  const signedUpTpl = templates['signed_up'];

  const { data: leads, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, status, name, email, phone, profile_type, form_type, auto_approved, linked_talent_user_id')
    .is('deleted_at', null)
    .neq('status', 'archived');

  if (error) throw error;
  if (!leads || leads.length === 0) {
    return { total: 0, sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Process in chunks of 10 to avoid hammering the CRM endpoint.
  const CHUNK = 10;
  for (let i = 0; i < leads.length; i += CHUNK) {
    const chunk = leads.slice(i, i + CHUNK);
    await Promise.allSettled(
      chunk.map(async (lead) => {
        // Stage mapping (most-advanced first):
        //   linked_talent_user_id set     → Signed Up
        //   status in shortlisted/partner_onboarding/onboard_completed → Shortlisted
        //   otherwise                     → Lead Received
        let eventKey: string;
        let tpl;
        if (lead.linked_talent_user_id) {
          eventKey = 'signed_up';
          tpl = signedUpTpl;
        } else if (
          lead.status === 'shortlisted' ||
          lead.status === 'partner_onboarding' ||
          lead.status === 'onboard_completed'
        ) {
          eventKey = 'shortlisted';
          tpl = shortlistedTpl;
        } else {
          eventKey = 'lead_received';
          tpl = receivedTpl;
        }

        if (!tpl?.enabled || !tpl.crm_webhook_url) {
          skipped += 1;
          return;
        }

        try {
          await sendCrmTemplateMessage(lead.id, eventKey, {
            name: lead.name,
            email: lead.email ?? '',
            phone: lead.phone ?? '',
            profile_type: lead.profile_type,
            form_type: lead.form_type,
          });
          sent += 1;
        } catch (err) {
          console.error('[automation] sync failed for lead', lead.id, err);
          failed += 1;
        }
      }),
    );
  }

  await logEvent({
    event_type: 'leads_crm_backfill',
    triggered_by: `admin:${adminUserId}`,
    metadata: { total: leads.length, sent, skipped, failed },
  });

  return { total: leads.length, sent, skipped, failed };
}
