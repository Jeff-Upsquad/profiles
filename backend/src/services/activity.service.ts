import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// ---------------------------------------------------------------------------
// Candidate / talent-user activity timeline
//
// Synthesises a unified, chronological activity feed for a candidate by merging
// several existing tables — no dedicated activity table is required. Almost
// every activity is derived from a timestamp that already lives on the row
// (created_at / submitted_at / reviewed_at / responded_at / …). The feed is
// keyed by EITHER a lead (candidate card / profile) or a talent user (user
// profile); we resolve the link between the two so both scopes are included.
// ---------------------------------------------------------------------------

export type ActivityCategory =
  | 'pipeline'
  | 'onboarding'
  | 'interview'
  | 'card'
  | 'note'
  | 'account'
  | 'comms'
  | 'system';

export interface ActivityItem {
  /** Stable, unique id (source-prefixed) so the client can key the list. */
  id: string;
  /** Machine-readable activity key, e.g. 'stage_changed', 'card_accepted'. */
  type: string;
  category: ActivityCategory;
  title: string;
  description?: string | null;
  /** Human actor label: 'System', 'Admin', or a name/email when known. */
  actor?: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Mirror of admin/src/views/leads/LeadList.tsx STAGE_LABELS so the panel can
// stay presentational. Falls back to a humanised key.
const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  share_form: 'Share Form',
  form_filled: 'Form Filled',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  signed_up: 'Signed Up',
  partner_onboarding: 'Onboarding',
  onboarding_training: 'Onboarding Training',
  basic_profile: 'Basic Profile',
  job_profile: 'Job Profile',
  portfolio_updation: 'Portfolio Updation',
  final_review: 'Final Review',
  onboard_completed: 'Completed',
  live: 'Live',
  no_response: 'No Response',
  archived: 'Archived',
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
};

function stageLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

// Human labels + categories for the automation_events we surface. Anything not
// listed is still shown with a humanised fallback so the feed never hides a
// real event.
const EVENT_META: Record<string, { title: string; category: ActivityCategory }> = {
  lead_auto_shortlisted: { title: 'Auto-shortlisted', category: 'pipeline' },
  shortlist_invite_sent: { title: 'Signup invitation sent', category: 'pipeline' },
  lead_signed_up: { title: 'Signed up', category: 'pipeline' },
  lead_stage_auto_advanced: { title: 'Stage auto-advanced', category: 'pipeline' },
  lead_status_changed: { title: 'Stage changed', category: 'pipeline' },
  crm_status_sync_sent: { title: 'Synced to CRM', category: 'system' },
  crm_status_sync_failed: { title: 'CRM sync failed', category: 'system' },
  crm_message_sent: { title: 'CRM message sent', category: 'system' },
  crm_message_failed: { title: 'CRM message failed', category: 'system' },
  crm_message_queued: { title: 'CRM message queued', category: 'system' },
  talent_card_whatsapp_sent: { title: 'WhatsApp sent', category: 'comms' },
  talent_card_whatsapp_failed: { title: 'WhatsApp failed', category: 'comms' },
  talent_card_whatsapp_throttled: { title: 'WhatsApp throttled', category: 'comms' },
  talent_card_whatsapp_optout: { title: 'WhatsApp opt-out', category: 'comms' },
  talent_card_whatsapp_skipped: { title: 'WhatsApp skipped', category: 'comms' },
};

// Jobs-module funnel stage labels (job_candidates.funnel_stage vocab).
const JOB_STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview_invited: 'Interview Invited',
  interview: 'Interview',
  on_hold: 'On Hold',
  selected: 'Selected',
  rejected: 'Rejected',
  offer: 'Offer',
  hired: 'Hired',
  placed: 'Placed',
  withdrawn: 'Withdrawn',
};

function jobStageLabel(stage: string | null | undefined): string | null {
  if (!stage) return null;
  return JOB_STAGE_LABELS[stage] ?? humaniseEventType(stage);
}

// Human labels + categories for the job_candidate_events audit rows. Known
// prefixes (interview_* / offer_*) get sensible categories so new event kinds
// surface without a map entry.
const JOB_EVENT_META: Record<string, { title: string; category: ActivityCategory }> = {
  stage_changed: { title: 'Job stage changed', category: 'pipeline' },
  offer_sent: { title: 'Offer sent', category: 'pipeline' },
};

const JOB_ACTOR_LABELS: Record<string, string> = {
  talent: 'Candidate',
  business: 'Business',
  admin: 'Admin',
  system: 'System',
};

function humaniseEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Turn a `triggered_by` marker ('system' | 'admin:<uuid>') into a label. */
function actorFromTriggeredBy(triggeredBy: string | null | undefined): string {
  if (!triggeredBy || triggeredBy === 'system') return 'System';
  if (triggeredBy.startsWith('admin:')) return 'Admin';
  return triggeredBy;
}

interface LeadRow {
  id: string;
  name: string | null;
  status: string | null;
  status_changed_at: string | null;
  created_at: string | null;
  deleted_at: string | null;
  archive_reason: string | null;
  linked_talent_user_id: string | null;
}

const LEAD_COLUMNS =
  'id, name, status, status_changed_at, created_at, deleted_at, archive_reason, linked_talent_user_id';

/**
 * Build the activity timeline for a candidate. Accepts either a lead id or a
 * talent-user id; resolves the counterpart so lead-scoped events (pipeline,
 * interviews) and talent-scoped events (cards, account, profiles) both appear.
 */
export async function getCandidateActivity(params: {
  leadId?: string;
  talentUserId?: string;
}): Promise<ActivityItem[]> {
  let leadRows: LeadRow[] = [];
  let talentUserId: string | null = params.talentUserId ?? null;

  if (params.leadId) {
    const { data, error } = await supabaseAdmin
      .from('lead_submissions')
      .select(LEAD_COLUMNS)
      .eq('id', params.leadId)
      .maybeSingle();
    if (error) throw new AppError(500, `Failed to load lead: ${error.message}`);
    if (!data) throw new AppError(404, 'Lead not found');
    leadRows = [data as LeadRow];
    talentUserId = talentUserId ?? (data as LeadRow).linked_talent_user_id ?? null;
  }

  if (params.talentUserId) {
    const { data, error } = await supabaseAdmin
      .from('lead_submissions')
      .select(LEAD_COLUMNS)
      .eq('linked_talent_user_id', params.talentUserId);
    if (error) throw new AppError(500, `Failed to load linked leads: ${error.message}`);
    leadRows = (data as LeadRow[]) ?? [];
  }

  const leadIds = leadRows.map((l) => l.id);
  const items: ActivityItem[] = [];

  // Track (leadId | to-status | epoch-second) of logged status transitions so
  // the synthesised "current stage" item doesn't duplicate a logged event.
  const loggedStatusKeys = new Set<string>();
  const statusKey = (leadId: string | null, to: string | null, iso: string | null) =>
    `${leadId ?? ''}|${to ?? ''}|${iso ? Math.floor(new Date(iso).getTime() / 1000) : ''}`;

  // --- automation_events (lead-scoped OR talent-scoped) ---------------------
  const orClauses: string[] = [];
  if (leadIds.length) orClauses.push(`lead_id.in.(${leadIds.join(',')})`);
  if (talentUserId) orClauses.push(`talent_user_id.eq.${talentUserId}`);
  if (orClauses.length) {
    const { data: events, error } = await supabaseAdmin
      .from('automation_events')
      .select('id, event_type, lead_id, talent_user_id, triggered_by, metadata, created_at')
      .or(orClauses.join(','))
      .order('created_at', { ascending: false });
    if (error) throw new AppError(500, `Failed to load events: ${error.message}`);
    for (const e of events ?? []) {
      const meta = EVENT_META[e.event_type];
      const md = (e.metadata ?? {}) as Record<string, unknown>;
      let description: string | null = null;
      if (typeof md.from === 'string' || typeof md.to === 'string') {
        description = `${stageLabel(md.from as string)} → ${stageLabel(md.to as string)}`;
        loggedStatusKeys.add(statusKey(e.lead_id, (md.to as string) ?? null, e.created_at));
      } else if (typeof md.error === 'string' && md.error) {
        description = md.error;
      } else if (typeof md.pipeline_stage === 'string') {
        description = md.pipeline_stage;
      }
      // Signed-up / auto-shortlist events are also status transitions — record
      // their key so the synthesised current-stage item can dedupe against them.
      if (e.event_type === 'lead_signed_up') loggedStatusKeys.add(statusKey(e.lead_id, 'signed_up', e.created_at));
      if (e.event_type === 'lead_auto_shortlisted') loggedStatusKeys.add(statusKey(e.lead_id, 'shortlisted', e.created_at));

      items.push({
        id: `event:${e.id}`,
        type: e.event_type,
        category: meta?.category ?? 'system',
        title: meta?.title ?? humaniseEventType(e.event_type),
        description,
        actor: actorFromTriggeredBy(e.triggered_by),
        timestamp: e.created_at,
        metadata: md,
      });
    }
  }

  // --- lead_submissions: application received / current stage / deleted -----
  for (const lead of leadRows) {
    if (lead.created_at) {
      items.push({
        id: `lead:${lead.id}:created`,
        type: 'application_received',
        category: 'pipeline',
        title: 'Application received',
        description: null,
        actor: 'Candidate',
        timestamp: lead.created_at,
      });
    }
    // The latest known stage move. Skipped when a logged status event already
    // covers this exact transition (avoids a duplicate going forward).
    if (
      lead.status_changed_at &&
      lead.status &&
      !loggedStatusKeys.has(statusKey(lead.id, lead.status, lead.status_changed_at))
    ) {
      items.push({
        id: `lead:${lead.id}:stage`,
        type: 'stage_changed',
        category: 'pipeline',
        title: `Moved to ${stageLabel(lead.status)}`,
        description:
          lead.status === 'archived' && lead.archive_reason
            ? lead.archive_reason.replace(/_/g, ' ')
            : null,
        actor: 'Admin',
        timestamp: lead.status_changed_at,
      });
    }
    if (lead.deleted_at) {
      items.push({
        id: `lead:${lead.id}:deleted`,
        type: 'moved_to_recycle_bin',
        category: 'pipeline',
        title: 'Moved to recycle bin',
        actor: 'Admin',
        timestamp: lead.deleted_at,
      });
    }
  }

  // --- lead_notes -----------------------------------------------------------
  if (leadIds.length) {
    const { data: notes, error } = await supabaseAdmin
      .from('lead_notes')
      .select('id, content, author_name, author_email, created_at, updated_at')
      .in('lead_id', leadIds)
      .order('created_at', { ascending: false });
    if (error) throw new AppError(500, `Failed to load notes: ${error.message}`);
    for (const n of notes ?? []) {
      const actor = n.author_name || n.author_email || 'Admin';
      items.push({
        id: `note:${n.id}`,
        type: 'note_added',
        category: 'note',
        title: 'Note added',
        description: n.content,
        actor,
        timestamp: n.created_at,
      });
      if (n.updated_at && n.updated_at !== n.created_at) {
        items.push({
          id: `note:${n.id}:edited`,
          type: 'note_edited',
          category: 'note',
          title: 'Note edited',
          description: n.content,
          actor,
          timestamp: n.updated_at,
        });
      }
    }
  }

  // --- interview_invitations ------------------------------------------------
  if (leadIds.length) {
    const { data: invites, error } = await supabaseAdmin
      .from('interview_invitations')
      .select('id, created_at, submitted_at, reviewed_at')
      .in('lead_id', leadIds);
    if (error) throw new AppError(500, `Failed to load interviews: ${error.message}`);
    for (const iv of invites ?? []) {
      if (iv.created_at) {
        items.push({
          id: `interview:${iv.id}:sent`,
          type: 'interview_invited',
          category: 'interview',
          title: 'Interview invitation sent',
          actor: 'Admin',
          timestamp: iv.created_at,
        });
      }
      if (iv.submitted_at) {
        items.push({
          id: `interview:${iv.id}:submitted`,
          type: 'interview_submitted',
          category: 'interview',
          title: 'Interview response submitted',
          actor: 'Candidate',
          timestamp: iv.submitted_at,
        });
      }
      if (iv.reviewed_at) {
        items.push({
          id: `interview:${iv.id}:reviewed`,
          type: 'interview_reviewed',
          category: 'interview',
          title: 'Interview reviewed',
          actor: 'Admin',
          timestamp: iv.reviewed_at,
        });
      }
    }
  }

  // --- subscription_card_recipients (talent-scoped) -------------------------
  if (talentUserId) {
    const { data: recips, error } = await supabaseAdmin
      .from('subscription_card_recipients')
      .select(
        'id, status, created_at, viewed_at, responded_at, business_review_status, business_reviewed_at, cancelled_at, subscription_cards(external_id)'
      )
      .eq('talent_user_id', talentUserId);
    if (error) throw new AppError(500, `Failed to load cards: ${error.message}`);
    for (const r of (recips as any[]) ?? []) {
      const cardRef: string | null = r.subscription_cards?.external_id ?? null;
      if (r.created_at) {
        items.push({
          id: `card:${r.id}:assigned`,
          type: 'card_assigned',
          category: 'card',
          title: 'Added to a review pool',
          description: cardRef,
          actor: 'System',
          timestamp: r.created_at,
        });
      }
      if (r.viewed_at) {
        items.push({
          id: `card:${r.id}:viewed`,
          type: 'card_viewed',
          category: 'card',
          title: 'Viewed opportunity',
          description: cardRef,
          actor: 'Candidate',
          timestamp: r.viewed_at,
        });
      }
      if (r.responded_at && (r.status === 'accepted' || r.status === 'rejected')) {
        items.push({
          id: `card:${r.id}:responded`,
          type: r.status === 'accepted' ? 'card_accepted' : 'card_declined',
          category: 'card',
          title: r.status === 'accepted' ? 'Accepted opportunity' : 'Declined opportunity',
          description: cardRef,
          actor: 'Candidate',
          timestamp: r.responded_at,
        });
      }
      if (r.business_reviewed_at && r.business_review_status) {
        items.push({
          id: `card:${r.id}:business_review`,
          type:
            r.business_review_status === 'shortlisted'
              ? 'business_shortlisted'
              : 'business_rejected',
          category: 'card',
          title:
            r.business_review_status === 'shortlisted'
              ? 'Shortlisted by business'
              : 'Not shortlisted by business',
          description: cardRef,
          actor: 'Business',
          timestamp: r.business_reviewed_at,
        });
      }
      if (r.cancelled_at) {
        items.push({
          id: `card:${r.id}:cancelled`,
          type: 'card_recalled',
          category: 'card',
          title: 'Opportunity recalled',
          description: cardRef,
          actor: 'System',
          timestamp: r.cancelled_at,
        });
      }
    }
  }

  // --- job_candidate_events (jobs-module hiring funnel audit trail) ---------
  // Immutable rows written by the jobs services (stage moves, interviews,
  // offers). Resolved through this talent's job_candidates; each item carries
  // the job's title so events from multiple openings stay distinguishable.
  if (talentUserId) {
    const { data: jcands, error: jcandErr } = await supabaseAdmin
      .from('job_candidates')
      .select('id, subscription_cards(content)')
      .eq('talent_user_id', talentUserId);
    if (jcandErr) throw new AppError(500, `Failed to load job candidates: ${jcandErr.message}`);

    const jobTitleByCandidate = new Map<string, string>();
    for (const c of (jcands ?? []) as any[]) {
      const content = (c.subscription_cards?.content ?? {}) as Record<string, unknown>;
      const title =
        typeof content.title === 'string' && content.title.trim() ? content.title.trim() : null;
      jobTitleByCandidate.set(c.id as string, title ?? 'a job');
    }
    const candIds = [...jobTitleByCandidate.keys()];

    if (candIds.length) {
      const { data: jEvents, error: jErr } = await supabaseAdmin
        .from('job_candidate_events')
        .select('id, candidate_id, actor_type, event_type, from_stage, to_stage, payload, created_at')
        .in('candidate_id', candIds)
        .order('created_at', { ascending: false });
      if (jErr) throw new AppError(500, `Failed to load job events: ${jErr.message}`);
      for (const ev of (jEvents ?? []) as any[]) {
        const meta = JOB_EVENT_META[ev.event_type];
        const md = (ev.payload ?? {}) as Record<string, unknown>;
        let category: ActivityCategory = meta?.category ?? 'system';
        if (!meta && ev.event_type.startsWith('interview_')) category = 'interview';
        if (!meta && ev.event_type.startsWith('offer_')) category = 'pipeline';
        const transition = [ev.from_stage, ev.to_stage]
          .map((s) => jobStageLabel(s))
          .filter(Boolean)
          .join(' → ');
        const parts = [jobTitleByCandidate.get(ev.candidate_id), transition].filter(Boolean);
        items.push({
          id: `jobevent:${ev.id}`,
          type: ev.event_type,
          category,
          title: meta?.title ?? humaniseEventType(ev.event_type),
          description: parts.join(' · ') || null,
          actor: JOB_ACTOR_LABELS[ev.actor_type] ?? humaniseEventType(ev.actor_type),
          timestamp: ev.created_at,
          metadata: md,
        });
      }
    }
  }

  // --- talent_users lifecycle ----------------------------------------------
  if (talentUserId) {
    const { data: tu, error } = await supabaseAdmin
      .from('talent_users')
      .select(
        'id, created_at, approval_status, approved_at, skip_onboarding_at, suspended_at, blacklisted_at'
      )
      .eq('id', talentUserId)
      .maybeSingle();
    if (error) throw new AppError(500, `Failed to load talent user: ${error.message}`);
    if (tu) {
      if (tu.created_at) {
        items.push({
          id: `talent:${tu.id}:created`,
          type: 'account_created',
          category: 'account',
          title: 'Created talent account',
          actor: 'Candidate',
          timestamp: tu.created_at,
        });
      }
      if (tu.approved_at) {
        items.push({
          id: `talent:${tu.id}:approved`,
          type: 'account_approved',
          category: 'account',
          title: 'Account approved',
          actor: 'Admin',
          timestamp: tu.approved_at,
        });
      }
      if (tu.skip_onboarding_at) {
        items.push({
          id: `talent:${tu.id}:skip_onboarding`,
          type: 'onboarding_skipped',
          category: 'onboarding',
          title: 'Onboarding skipped',
          actor: 'Admin',
          timestamp: tu.skip_onboarding_at,
        });
      }
      if (tu.suspended_at) {
        items.push({
          id: `talent:${tu.id}:suspended`,
          type: 'account_suspended',
          category: 'account',
          title: 'Account suspended',
          actor: 'Admin',
          timestamp: tu.suspended_at,
        });
      }
      if (tu.blacklisted_at) {
        items.push({
          id: `talent:${tu.id}:blacklisted`,
          type: 'account_blacklisted',
          category: 'account',
          title: 'Account blacklisted',
          actor: 'Admin',
          timestamp: tu.blacklisted_at,
        });
      }
    }
  }

  // --- talent_profiles review ----------------------------------------------
  if (talentUserId) {
    const { data: profiles, error } = await supabaseAdmin
      .from('talent_profiles')
      .select('id, status, created_at, reviewed_at')
      .eq('talent_user_id', talentUserId)
      .is('deleted_at', null);
    if (error) throw new AppError(500, `Failed to load profiles: ${error.message}`);
    for (const p of profiles ?? []) {
      if (p.created_at) {
        items.push({
          id: `profile:${p.id}:created`,
          type: 'profile_created',
          category: 'onboarding',
          title: 'Profile created',
          actor: 'Candidate',
          timestamp: p.created_at,
        });
      }
      if (p.reviewed_at) {
        const approved = p.status === 'approved' || p.status === 'published' || p.status === 'live';
        const rejected = p.status === 'rejected';
        items.push({
          id: `profile:${p.id}:reviewed`,
          type: 'profile_reviewed',
          category: 'onboarding',
          title: approved ? 'Profile approved' : rejected ? 'Profile rejected' : 'Profile reviewed',
          actor: 'Admin',
          timestamp: p.reviewed_at,
        });
      }
    }
  }

  // Newest first.
  return items
    .filter((i) => !!i.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
