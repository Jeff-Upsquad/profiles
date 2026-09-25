// "Request changes" for the basic profile — one common request per talent.
// Mirrors profile-review-changes.service.ts (job profiles) but operates on
// talent_profiles_basic, which has no status column: the basic profile is
// always live, so openness is derived (changes_requested_at set +
// reviewed_at null = open; resubmitted_at set = awaiting accept).

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { basicProfileChecklist } from './onboarding-hub.service.js';
import {
  CHANGES_REQUESTED_EVENT,
  getSharedChecklist,
  type ChecklistItem,
  type RequestedChange,
  type RequestChangesInput,
  talentAccountUrl,
} from './profile-review-changes.service.js';

// Checklist scoped to what a basic-profile request can tick: the shared
// `basic.*` / `identity.*` items. Job-profile (`job.*`, `field.*`) items are
// excluded — those belong to per-job-profile requests.
export async function getBasicChecklist(): Promise<ChecklistItem[]> {
  const shared = await getSharedChecklist();
  return shared.filter((i) => i.key.startsWith('basic.') || i.key.startsWith('identity.'));
}

export function hasOpenBasicChanges(
  basic: { changes_requested_at?: string | null; reviewed_at?: string | null } | null,
): boolean {
  return !!basic?.changes_requested_at && basic.reviewed_at == null;
}

export function needsBasicResubmission(
  basic: { changes_requested_at?: string | null; reviewed_at?: string | null; resubmitted_at?: string | null } | null,
): boolean {
  return hasOpenBasicChanges(basic) && !basic?.resubmitted_at;
}

function whatsappFollowupText(
  talentName: string | null,
  changes: RequestedChange[],
  accountUrl: string,
): string {
  const hi = talentName?.trim() ? `Hi ${talentName.trim().split(/\s+/)[0]},` : 'Hi,';
  const lines = changes.map(
    (c, i) => `${i + 1}. ${c.message}${c.note ? ` (${c.note})` : ''}`,
  );
  return [
    `${hi} your UpSquad basic profile needs some updates.`,
    '',
    `Open your account: ${accountUrl}`,
    '',
    'Please update the following so we can review the changes:',
    ...lines,
    '',
    'Make the changes and tap "Resubmit for review". We\'ll take another look right after. Your profile stays live.',
    '',
    '– UpSquad team',
  ].join('\n');
}

function whatsappSummary(changes: RequestedChange[]): string {
  const lines = changes.map((c) => (c.note ? `${c.message} (${c.note})` : c.message));
  const shown = lines.slice(0, 5);
  const rest = lines.length - shown.length;
  // Meta rejects template params containing newlines/tabs or 4+ spaces.
  const text = shown.join('; ') + (rest > 0 ? `; and ${rest} more (see the app)` : '');
  return text.replace(/\s+/g, ' ').trim();
}

export async function requestBasicChanges(
  talentUserId: string,
  adminId: string,
  input: RequestChangesInput,
) {
  const { data: basic, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles_basic')
    .select('talent_user_id, requested_changes, changes_requested_at, resubmitted_at, reviewed_at')
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (fetchErr) throw new AppError(500, fetchErr.message);
  if (!basic) throw new AppError(404, 'Basic profile not started yet');
  if (hasOpenBasicChanges(basic) && !basic.resubmitted_at) {
    throw new AppError(400, 'Changes have already been requested for this basic profile');
  }

  const checklist = await getBasicChecklist();
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
    .from('talent_profiles_basic')
    .update({
      requested_changes: changes,
      changes_requested_at: now,
      changes_requested_by: adminId,
      resubmitted_at: null,
      reviewed_at: null,
    })
    .eq('talent_user_id', talentUserId)
    .select('*')
    .single();
  if (error || !updated) throw new AppError(400, error?.message ?? 'Failed to request changes');

  const { data: talent } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone')
    .eq('id', talentUserId)
    .maybeSingle();

  // In-app notification (best-effort).
  try {
    const { notifyTalentsInApp } = await import('./jobs.service.js');
    await notifyTalentsInApp(
      [talentUserId],
      'basic_profile_changes_requested',
      'Your basic profile needs a few updates',
      changes.map((c) => `• ${c.message}`).join('\n'),
      '/talent/basic-profile',
    );
  } catch (e) {
    console.error('[basic-changes] in-app notify failed:', e);
  }

  // WhatsApp via the SquadHire CRM system event (same event as job-profile
  // requests — `category: Basic` flows into the mapped template params).
  let whatsappSent: boolean | null = null;
  if (input.send_whatsapp !== false && talent?.phone) {
    const accountUrl = talentAccountUrl('/talent/basic-profile');
    whatsappSent = await deliverCrmSystemEvent({
      audience: 'talent',
      event: CHANGES_REQUESTED_EVENT,
      name: talent.full_name ?? null,
      phone: talent.phone,
      data: {
        category: 'Basic',
        changes: whatsappSummary(changes),
        changes_count: String(changes.length),
        account_url: accountUrl,
        followup_text: whatsappFollowupText(talent.full_name ?? null, changes, accountUrl),
      },
    });
    await supabaseAdmin
      .from('talent_profiles_basic')
      .update({ changes_whatsapp_sent: whatsappSent })
      .eq('talent_user_id', talentUserId);
  }

  return { ...updated, changes_whatsapp_sent: whatsappSent };
}

// Requested items that are still empty in the saved profile. Saves are
// per-section, so a talent could tap Resubmit with unsaved edits and the
// reviewer would see "Resubmitted" over unchanged data. Only checklist-backed
// `basic.*` keys are verifiable; `identity.*` and free-text "Other" pass.
// Freelance / partner hours pass once that work type is no longer selected.
async function unresolvedBasicChanges(userId: string): Promise<string[]> {
  const [{ data: basic }, { data: talent }] = await Promise.all([
    supabaseAdmin.from('talent_profiles_basic').select('*').eq('talent_user_id', userId).maybeSingle(),
    supabaseAdmin.from('talent_users').select('full_name, languages_spoken').eq('id', userId).maybeSingle(),
  ]);
  const checklist = basicProfileChecklist(basic, {
    full_name: talent?.full_name ?? null,
    languages_spoken: talent?.languages_spoken,
  });
  const byKey = new Map(checklist.map((c) => [`basic.${c.key}`, c]));
  const requested = (basic?.requested_changes ?? []) as RequestedChange[];
  return requested
    .filter((c) => {
      const item = byKey.get(c.key);
      if (!item || item.done) return false;
      if ((item.key === 'freelance' || item.key === 'partner_hours') && !item.required) return false;
      return true;
    })
    .map((c) => c.label);
}

/** Talent taps "Resubmit for review" on the basic profile after fixing. */
export async function resubmitBasicProfile(userId: string) {
  const { data: basic, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles_basic')
    .select('talent_user_id, changes_requested_at, resubmitted_at, reviewed_at')
    .eq('talent_user_id', userId)
    .maybeSingle();
  if (fetchErr) throw new AppError(500, fetchErr.message);
  if (!basic || !hasOpenBasicChanges(basic)) {
    throw new AppError(400, 'No requested changes to resubmit');
  }
  if (basic.resubmitted_at) throw new AppError(400, 'Already resubmitted — waiting for review');

  const unresolved = await unresolvedBasicChanges(userId);
  if (unresolved.length > 0) {
    throw new AppError(
      400,
      `Please fill in and save: ${unresolved.join(', ')} — then tap Resubmit.`,
    );
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles_basic')
    .update({ resubmitted_at: new Date().toISOString() })
    .eq('talent_user_id', userId)
    .select('*')
    .single();
  if (error) throw new AppError(500, 'Failed to resubmit basic profile');
  return data;
}

/** Reviewer accepts the resubmitted basic-profile updates. History is kept. */
export async function acceptBasicChanges(talentUserId: string, adminId: string) {
  const { data: basic, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles_basic')
    .select('talent_user_id, changes_requested_at, resubmitted_at, reviewed_at')
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (fetchErr) throw new AppError(500, fetchErr.message);
  if (!basic || !hasOpenBasicChanges(basic) || !basic.resubmitted_at) {
    throw new AppError(400, 'No resubmitted basic-profile updates to accept');
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles_basic')
    .update({
      reviewed_at: new Date().toISOString(),
      resubmitted_at: null,
      changes_requested_by: adminId,
    })
    .eq('talent_user_id', talentUserId)
    .select('*')
    .single();
  if (error) throw new AppError(500, 'Failed to accept basic-profile updates');
  return data;
}
