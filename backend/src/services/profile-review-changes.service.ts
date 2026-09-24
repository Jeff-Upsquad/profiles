// "Request changes" review outcome for job profiles.
//
// Approve / Reject already exist on the review panel. This adds the middle
// path: the reviewer ticks what the talent must fix, the profile moves to
// `changes_requested` (out of the review queue, into "Waiting on talent"),
// the talent is told in-app and on WhatsApp (via the SquadHire CRM system
// event), and a "Resubmit for review" tap (the existing PATCH /submit) brings
// it back to pending_review — see talent.service submitProfile.

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { getAdminSetting, setAdminSetting } from './admin.service.js';
import { isGhostSourceCategory, syncGhostForTalent } from './ghost-profile.service.js';

export const REVIEW_CHECKLIST_SETTING = 'review_checklist';
export const CHANGES_REQUESTED_EVENT = 'talent_profile_changes_requested';

/**
 * Public talent route for a request-change message. Opens straight into the
 * app when they're signed in; otherwise login bounces them back here via
 * `?next=`. FRONTEND_URL is internal (IP:port) on prod, so use the public
 * origin (same override as the public forms).
 */
export function talentAccountUrl(path: string): string {
  const origin = (process.env.PUBLIC_FORMS_BASE_URL || 'https://squadhire.upsquadconnect.com').trim().replace(/\/+$/, '');
  return `${origin}${path}`;
}

// Max ticked items spelled out in the WhatsApp body before we say "and N more".
const WHATSAPP_MAX_ITEMS = 5;

export interface ChecklistItem {
  /** Stable id. `basic.*`, `identity.*`, `job.*` are shared; `field.<field_key>` is per-category. */
  key: string;
  section: string;
  /** Short label shown to the reviewer. */
  label: string;
  /** Talent-facing instruction (in-app + WhatsApp). */
  message: string;
}

export interface RequestedChange extends ChecklistItem {
  /** Free-text add-on from the reviewer (the "Other" line, or a note on an item). */
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Checklist (shared items from admin_settings + per-category form fields)
// ---------------------------------------------------------------------------

function sanitizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ChecklistItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    const message = typeof o.message === 'string' ? o.message.trim() : '';
    const section = typeof o.section === 'string' && o.section.trim() ? o.section.trim() : 'Other';
    if (!key || !label || !message || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, section, label, message });
  }
  return out;
}

export async function getSharedChecklist(): Promise<ChecklistItem[]> {
  const raw = await getAdminSetting<unknown>(REVIEW_CHECKLIST_SETTING);
  return sanitizeChecklist(raw);
}

export async function saveSharedChecklist(items: unknown, adminId: string): Promise<ChecklistItem[]> {
  const clean = sanitizeChecklist(items);
  if (clean.length === 0) throw new AppError(400, 'Checklist needs at least one item');
  if (clean.some((i) => i.key.startsWith('field.'))) {
    throw new AppError(400, '`field.*` keys are reserved for category form fields');
  }
  await setAdminSetting(REVIEW_CHECKLIST_SETTING, clean, adminId);
  return clean;
}

// Portfolio items we ask for when nudging a draft (sales is exempt). Stricter
// than the talent-side submit gate in ProfileCreate/ProfileEdit, which needs 1.
export const MIN_PORTFOLIO_ITEMS = 10;

// Extra items offered when nudging a talent whose job profile is still a
// draft (never submitted). The admin panel pre-ticks the ones that apply.
export const DRAFT_CHECKLIST: ChecklistItem[] = [
  {
    key: 'job.submit_draft',
    section: 'Draft — not submitted yet',
    label: 'Submit for review',
    message: 'Your job profile is still a draft. Complete it and tap "Submit for review" so we can review it',
  },
  {
    key: 'job.portfolio_minimum',
    section: 'Draft — not submitted yet',
    label: `Add at least ${MIN_PORTFOLIO_ITEMS} portfolio items`,
    message: `Add at least ${MIN_PORTFOLIO_ITEMS} portfolio items — it's the minimum we need to review your profile`,
  },
];

/** Shared items plus one "Fix: <label>" entry per field of this category's form. */
export async function getChecklistForCategory(
  categoryId: string | null,
  opts: { draft?: boolean } = {},
): Promise<ChecklistItem[]> {
  const shared = opts.draft ? [...DRAFT_CHECKLIST, ...(await getSharedChecklist())] : await getSharedChecklist();
  if (!categoryId) return shared;

  const { data: fields } = await supabaseAdmin
    .from('category_fields')
    .select('field_key, field_label')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  const fieldItems: ChecklistItem[] = (fields ?? []).map((f: any) => ({
    key: `field.${f.field_key}`,
    section: 'Job profile fields',
    label: `Fix: ${f.field_label}`,
    message: `Update the "${f.field_label}" section of your job profile`,
  }));
  return [...shared, ...fieldItems];
}

// ---------------------------------------------------------------------------
// Request changes (reviewer)
// ---------------------------------------------------------------------------

export interface RequestChangesInput {
  /** Checklist keys ticked by the reviewer. */
  keys: string[];
  /** Free text for the "Other — describe" line. */
  other?: string | null;
  /** Optional per-item notes keyed by checklist key. */
  notes?: Record<string, string> | null;
  /** Default true. */
  send_whatsapp?: boolean;
}

// Full checklist as a free-text WhatsApp message. The CRM sends the mapped
// template with its account button first, then this text directly inside the
// 24h window or as a reply follow-up after their next message.
function whatsappFollowupText(
  talentName: string | null,
  categoryName: string,
  changes: RequestedChange[],
  wasApproved: boolean,
  isDraft: boolean,
  accountUrl: string,
): string {
  const hi = talentName?.trim() ? `Hi ${talentName.trim().split(/\s+/)[0]},` : 'Hi,';
  const lines = changes.map(
    (c, i) => `${i + 1}. ${c.message}${c.note ? ` (${c.note})` : ''}`,
  );
  if (isDraft) {
    return [
      `${hi} your UpSquad ${categoryName} profile is still a draft — it hasn't been submitted for review yet.`,
      '',
      `Open your account: ${accountUrl}`,
      '',
      'To get it reviewed, please:',
      ...lines,
      '',
      'Complete your profile and tap "Submit for review". We\'ll take a look right after.',
      '',
      '– UpSquad team',
    ].join('\n');
  }
  return [
    wasApproved
      ? `${hi} your UpSquad ${categoryName} profile needs some updates.`
      : `${hi} thanks for submitting your UpSquad ${categoryName} profile.`,
    '',
    `Open your account: ${accountUrl}`,
    '',
    wasApproved ? 'Please update the following so we can review the changes:' : 'Before we can approve it, please update the following:',
    ...lines,
    '',
    `Make the changes and tap "Resubmit for review". We'll take another look right after.${wasApproved ? ' Your profile stays live.' : ''}`,
    '',
    '– UpSquad team',
  ].join('\n');
}

function whatsappSummary(changes: RequestedChange[]): string {
  const lines = changes.map((c) => (c.note ? `${c.message} (${c.note})` : c.message));
  const shown = lines.slice(0, WHATSAPP_MAX_ITEMS);
  const rest = lines.length - shown.length;
  // Meta rejects template params containing newlines/tabs or 4+ spaces.
  const text = shown.join('; ') + (rest > 0 ? `; and ${rest} more (see the app)` : '');
  return text.replace(/\s+/g, ' ').trim();
}

export async function requestProfileChanges(
  profileId: string,
  adminId: string,
  input: RequestChangesInput,
) {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, talent_user_id, category_id, status, deleted_at, reviewed_at, changes_requested_at, resubmitted_at, categories(name)')
    .eq('id', profileId)
    .single();
  if (fetchErr || !profile || profile.deleted_at) throw new AppError(404, 'Profile not found');
  // Drafts can be nudged too: the talent never submitted, so the request asks
  // them to finish + submit. The profile stays `draft` (it was never reviewed),
  // it just carries the requested list until they submit.
  const isDraft = profile.status === 'draft';
  if (profile.status !== 'pending_review' && profile.status !== 'approved' && !isDraft) {
    throw new AppError(400, 'Only draft, pending or approved profiles can have changes requested');
  }
  if (profile.status === 'approved' && profile.reviewed_at === null && profile.changes_requested_at && !profile.resubmitted_at) {
    throw new AppError(400, 'Changes have already been requested for this live profile');
  }

  const checklist = await getChecklistForCategory(profile.category_id, { draft: isDraft });
  const byKey = new Map(checklist.map((c) => [c.key, c]));
  const changes: RequestedChange[] = [];
  for (const key of [...new Set(input.keys ?? [])]) {
    const item = byKey.get(key);
    if (!item) continue;
    const note = input.notes?.[key]?.trim();
    changes.push({ ...item, note: note || null });
  }
  const other = (input.other ?? '').trim();
  if (other) {
    changes.push({ key: 'other', section: 'Other', label: 'Other', message: other, note: null });
  }
  if (changes.length === 0) throw new AppError(400, 'Pick at least one change to request');

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('talent_profiles')
    .update(isDraft
      ? {
          requested_changes: changes,
          changes_requested_at: now,
          changes_requested_by: adminId,
          resubmitted_at: null,
        }
      : {
          status: profile.status === 'approved' ? 'approved' : 'changes_requested',
          requested_changes: changes,
          changes_requested_at: now,
          changes_requested_by: adminId,
          resubmitted_at: null,
          reviewed_by: adminId,
          reviewed_at: profile.status === 'approved' ? null : now,
          rejection_reason: null,
        })
    .eq('id', profileId)
    .eq('status', profile.status)
    .select('*')
    .single();
  if (error || !updated) throw new AppError(400, error?.message ?? 'Failed to request changes');

  if (await isGhostSourceCategory(profile.category_id)) {
    await syncGhostForTalent(profile.talent_user_id);
  }

  const categoryName = (profile as any).categories?.name ?? 'job';
  const { data: talent } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone')
    .eq('id', profile.talent_user_id)
    .maybeSingle();

  // In-app notification (best-effort).
  try {
    const { notifyTalentsInApp } = await import('./jobs.service.js');
    await notifyTalentsInApp(
      [profile.talent_user_id],
      'profile_changes_requested',
      isDraft ? `Finish and submit your ${categoryName} profile` : `Your ${categoryName} profile needs a few updates`,
      changes.map((c) => `• ${c.message}`).join('\n'),
      `/talent/profiles/${profileId}/edit`,
    );
  } catch (e) {
    console.error('[review-changes] in-app notify failed:', e);
  }

  // WhatsApp via SquadHire CRM. The mapped template carries an account URL
  // button; the checklist follows directly or after the talent's next reply.
  let whatsappSent: boolean | null = null;
  if (input.send_whatsapp !== false && talent?.phone) {
    const accountUrl = talentAccountUrl(`/talent/profiles/${profileId}/edit`);
    whatsappSent = await deliverCrmSystemEvent({
      audience: 'talent',
      event: CHANGES_REQUESTED_EVENT,
      name: talent.full_name ?? null,
      phone: talent.phone,
      data: {
        category: categoryName,
        changes: whatsappSummary(changes),
        changes_count: String(changes.length),
        account_url: accountUrl,
        followup_text: whatsappFollowupText(talent.full_name ?? null, categoryName, changes, profile.status === 'approved', isDraft, accountUrl),
      },
    });
    await supabaseAdmin
      .from('talent_profiles')
      .update({ changes_whatsapp_sent: whatsappSent })
      .eq('id', profileId);
  }

  return { ...updated, changes_whatsapp_sent: whatsappSent };
}
