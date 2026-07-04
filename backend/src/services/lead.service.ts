import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { evaluateAutoApproval, parseConfig } from './auto-approval.service.js';
import { isBasicProfileMandatoryComplete } from './talent.service.js';
import type {
  CreateLeadInput,
  UpdateLeadStatusInput,
  UpdateLeadProfileTypeInput,
} from '../validators/lead.validators.js';

// ---------------------------------------------------------------------------
// Submit (public)
// ---------------------------------------------------------------------------

export async function createLeadSubmission(input: CreateLeadInput) {
  const { form_type, name, phone, email, utm_source, utm_medium, utm_campaign, ...rest } = input;

  // Build form_data from the remaining fields
  const form_data = rest;

  // Extract resume_url as a top-level column for accountant forms
  const resume_url = form_type === 'accountant' ? (rest as any).resume_url : null;

  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .insert({
      form_type,
      name,
      phone,
      email,
      form_data,
      resume_url,
      // Submitting the public form IS the "form filled" event, so the lead is
      // created directly at the 'form_filled' stage (→ "Form Filled / For
      // Review") rather than the enum default 'new'.
      status: 'form_filled',
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
    })
    .select('id')
    .single();

  if (error) throw new AppError(500, `Failed to create lead: ${error.message}`);

  try {
    const { onLeadReceived, onLeadStatusChanged } = await import('./automation.service.js');
    await onLeadReceived(data.id, form_type, { name, email, phone });
    // Fire the generic status-mapping webhook for the initial 'form_filled'
    // state so the CRM creates/updates the card at "Form Filled / For Review"
    // via the same code path used for every subsequent transition.
    await onLeadStatusChanged(data.id, 'form_filled', null);
  } catch (err) {
    console.error('[automation] onLeadReceived failed:', err);
  }

  // Auto-approval check
  const { data: formRow } = await supabaseAdmin
    .from('public_forms')
    .select('auto_approval_rules')
    .eq('form_type', form_type)
    .single();

  const config = parseConfig(formRow?.auto_approval_rules);
  const allFields: Record<string, unknown> = { form_type, name, phone, email, ...rest };
  const approved = evaluateAutoApproval(config, allFields);

  if (approved) {
    await supabaseAdmin
      .from('lead_submissions')
      .update({ auto_approved: true })
      .eq('id', data.id);

    // Auto-invite: create a pending talent invitation so the candidate can
    // sign up. Not initiated by an admin, so invited_by is NULL.
    // Silently swallow errors (e.g. already-pending unique violation) — the
    // lead submission itself must always succeed.
    try {
      await supabaseAdmin.from('invitations').insert({
        email: email.toLowerCase(),
        role: 'talent',
        status: 'pending',
        invited_by: null,
      });
    } catch (err) {
      // Existing pending invitation, RLS, or any other invitation-side issue.
      // Auto-approval already succeeded — the candidate's experience is
      // unaffected, and an admin can manually invite if needed.
      console.error('[auto-invite] failed:', err);
    }
  }

  if (approved) {
    try {
      const { onLeadAutoApproved } = await import('./automation.service.js');
      await onLeadAutoApproved(data.id, email);
    } catch (err) {
      console.error('[automation] onLeadAutoApproved failed:', err);
    }
  }

  return {
    id: data.id,
    auto_approved: approved,
    redirect_url: approved ? config.approved_redirect_url || undefined : undefined,
    approved_message: approved ? config.approved_message : undefined,
  };
}

// ---------------------------------------------------------------------------
// Existence check (public)
// ---------------------------------------------------------------------------

export async function checkContactExists(input: { email?: string; phone?: string }) {
  const email = input.email?.trim().toLowerCase() || null;
  const phoneDigits = input.phone
    ? input.phone.replace(/\D/g, '').slice(-10)
    : null;
  const phoneArg = phoneDigits && phoneDigits.length === 10 ? phoneDigits : null;
  if (!email && !phoneArg) return { exists: false };

  const { data, error } = await supabaseAdmin.rpc('check_contact_exists', {
    p_email: email,
    p_phone_digits: phoneArg,
  });
  if (error) throw new AppError(500, `Failed to check contact: ${error.message}`);
  return { exists: (data ?? []).length > 0 };
}

// ---------------------------------------------------------------------------
// List (admin)
// ---------------------------------------------------------------------------

export type FormDataFilterRule = {
  field: string;
  op: 'eq' | 'contains';
  value: string;
  // 'array' = form_data[field] is a jsonb array of strings (multi-select).
  //   The rule matches when the array includes `value`.
  // 'scalar' (or undefined) = form_data[field] is a single value (text/number).
  kind?: 'scalar' | 'array';
};

// Safety: only allow identifier-shaped field names so we can splice them into
// the jsonb path without any escape concerns. Top-level keys in form_data are
// always declared in the lead form schemas which use snake_case identifiers.
const SAFE_FIELD_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

export async function getLeadSubmissions(filters: {
  form_type?: string;
  form_types?: string[];
  status?: string;
  profile_type?: string;
  search?: string;
  role?: string;
  signed_up?: string;
  deleted?: string;
  page?: number;
  limit?: number;
  form_data_filter?: FormDataFilterRule[];
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('lead_submissions')
    .select('*, linked_talent:linked_talent_user_id(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Soft-delete filter: by default exclude deleted leads. Pass deleted=true to
  // see only deleted ones (recycle bin), or deleted=any to include both.
  if (filters.deleted === 'true') {
    query = query.not('deleted_at', 'is', null);
  } else if (filters.deleted !== 'any') {
    query = query.is('deleted_at', null);
  }

  if (filters.form_type) {
    query = query.eq('form_type', filters.form_type);
  } else if (filters.form_types && filters.form_types.length > 0) {
    // Category-scoped staff: constrain to their allowed categories.
    query = query.in('form_type', filters.form_types);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.profile_type) {
    if (filters.profile_type === 'none') {
      query = query.is('profile_type', null);
    } else {
      query = query.eq('profile_type', filters.profile_type);
    }
  }
  if (filters.role) {
    query = query.filter('form_data->role', 'cs', JSON.stringify([filters.role]));
  }
  if (filters.signed_up === 'true') {
    query = query.not('linked_talent_user_id', 'is', null);
  } else if (filters.signed_up === 'false') {
    query = query.is('linked_talent_user_id', null);
  }
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }
  if (filters.form_data_filter && filters.form_data_filter.length > 0) {
    for (const rule of filters.form_data_filter) {
      if (!SAFE_FIELD_RE.test(rule.field)) {
        throw new AppError(400, `Invalid form_data field name: ${rule.field}`);
      }
      if (rule.kind === 'array') {
        // jsonb @> [value] — the form_data field is a jsonb array and we want
        // candidates whose array includes the given value.
        query = query.filter(
          `form_data->${rule.field}`,
          'cs',
          JSON.stringify([rule.value])
        );
        continue;
      }
      const path = `form_data->>${rule.field}`;
      if (rule.op === 'eq') {
        query = query.filter(path, 'eq', rule.value);
      } else if (rule.op === 'contains') {
        // PostgREST ilike uses * as the wildcard.
        query = query.filter(path, 'ilike', `*${rule.value}*`);
      } else {
        throw new AppError(400, `Unsupported filter op: ${rule.op}`);
      }
    }
  }

  const { data, error, count } = await query;
  if (error) throw new AppError(500, `Failed to fetch leads: ${error.message}`);

  return {
    leads: data ?? [],
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  };
}

// ---------------------------------------------------------------------------
// Onboarding list (admin) — signed-up candidates with onboarding_progress
// ---------------------------------------------------------------------------

export async function getOnboardingLeads(filters: {
  form_type?: string;
  form_types?: string[];
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('lead_submissions')
    .select(
      '*, linked_talent:linked_talent_user_id(id, full_name, languages_spoken, onboarding_completed, skip_onboarding)',
      { count: 'exact' }
    )
    .is('deleted_at', null)
    .not('linked_talent_user_id', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.form_type) {
    query = query.eq('form_type', filters.form_type);
  } else if (filters.form_types && filters.form_types.length > 0) {
    query = query.in('form_type', filters.form_types);
  }
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new AppError(500, `Failed to fetch onboarding leads: ${error.message}`);

  const leads = data ?? [];
  const talentIds = leads
    .map((l: any) => l.linked_talent_user_id as string | null)
    .filter((v): v is string => !!v);

  // Columns needed to evaluate isBasicProfileMandatoryComplete. Kept in
  // sync with the same constant in talent.service.ts.
  const BASIC_COLUMNS =
    'talent_user_id, permanent_country, permanent_state, permanent_district, permanent_city, ' +
    'availability, job_type, employment_type, virtual_office_hours, education_courses, experience, ' +
    'aadhaar_number, pan_number, profile_picture_url, ' +
    'bank_account_holder, bank_account_number, bank_ifsc_code, ' +
    'resume_url';

  let basicByTalent = new Map<string, Record<string, any>>();
  // Per-talent list of job profiles, each carrying both the id (for
  // portfolio lookups) and the status (for the new job-profile-stage
  // rule that only submitted/approved profiles count).
  let jobProfilesByTalent = new Map<string, Array<{ id: string; status: string }>>();

  if (talentIds.length > 0) {
    const [basicRes, jobRes] = await Promise.all([
      supabaseAdmin
        .from('talent_profiles_basic')
        .select(BASIC_COLUMNS)
        .in('talent_user_id', talentIds),
      supabaseAdmin
        .from('talent_profiles')
        .select('id, talent_user_id, status')
        .in('talent_user_id', talentIds),
    ]);

    for (const row of basicRes.data ?? []) {
      const tid = (row as any).talent_user_id as string;
      if (tid) basicByTalent.set(tid, row as Record<string, any>);
    }
    for (const row of jobRes.data ?? []) {
      const tid = (row as any).talent_user_id as string;
      const pid = (row as any).id as string;
      const status = (row as any).status as string;
      if (!tid || !pid) continue;
      const arr = jobProfilesByTalent.get(tid) ?? [];
      arr.push({ id: pid, status });
      jobProfilesByTalent.set(tid, arr);
    }
  }

  const allProfileIds = Array.from(jobProfilesByTalent.values())
    .flat()
    .map((p) => p.id);
  let profilesWithPortfolio = new Set<string>();
  if (allProfileIds.length > 0) {
    const { data: portfolioRows } = await supabaseAdmin
      .from('portfolio_items')
      .select('profile_id')
      .in('profile_id', allProfileIds);
    profilesWithPortfolio = new Set(
      (portfolioRows ?? []).map((r: any) => r.profile_id as string)
    );
  }

  const enriched = leads.map((lead: any) => {
    const talentId = lead.linked_talent_user_id as string | null;
    const progress = {
      signed_up: !!talentId,
      onboarding_completed:
        !!lead.linked_talent?.onboarding_completed ||
        !!lead.linked_talent?.skip_onboarding,
      onboarding_bypassed: !!lead.linked_talent?.skip_onboarding,
      basic_profile_completed: false,
      job_profile_completed: false,
      portfolio_completed: false,
    };
    if (talentId) {
      const basic = basicByTalent.get(talentId) ?? null;
      progress.basic_profile_completed = isBasicProfileMandatoryComplete(basic, {
        full_name: (lead.linked_talent?.full_name as string | null) ?? null,
        languages_spoken: lead.linked_talent?.languages_spoken,
      });
      const profiles = jobProfilesByTalent.get(talentId) ?? [];
      // Job profile stage ticks only when the talent has at least one
      // profile in `pending_review` or `approved` — drafts and rejected
      // profiles do not count.
      progress.job_profile_completed = profiles.some(
        (p) => p.status === 'approved' || p.status === 'pending_review',
      );
      progress.portfolio_completed = profiles.some((p) =>
        profilesWithPortfolio.has(p.id)
      );
    }
    return { ...lead, onboarding_progress: progress };
  });

  return {
    leads: enriched,
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  };
}

// ---------------------------------------------------------------------------
// Detail (admin)
// ---------------------------------------------------------------------------

export async function getLeadSubmission(id: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('*, linked_talent:linked_talent_user_id(id, full_name, languages_spoken, onboarding_completed, skip_onboarding)')
    .eq('id', id)
    .single();

  if (error) throw new AppError(404, 'Lead not found');

  const talentId = data.linked_talent_user_id as string | null;
  let onboarding_progress = {
    signed_up: false,
    onboarding_completed: false,
    onboarding_bypassed: false,
    basic_profile_completed: false,
    job_profile_completed: false,
    portfolio_completed: false,
  };

  if (talentId) {
    onboarding_progress.signed_up = true;
    onboarding_progress.onboarding_completed =
      !!(data.linked_talent as any)?.onboarding_completed ||
      !!(data.linked_talent as any)?.skip_onboarding;
    onboarding_progress.onboarding_bypassed =
      !!(data.linked_talent as any)?.skip_onboarding;

    // Columns needed to evaluate isBasicProfileMandatoryComplete.
    // Kept in sync with the same constant in talent.service.ts.
    const BASIC_COLUMNS =
      'talent_user_id, permanent_country, permanent_state, permanent_district, permanent_city, ' +
      'availability, job_type, employment_type, virtual_office_hours, education_courses, experience, ' +
      'aadhaar_number, pan_number, profile_picture_url, ' +
      'bank_account_holder, bank_account_number, bank_ifsc_code, ' +
      'resume_url';

    const { data: basic } = await supabaseAdmin
      .from('talent_profiles_basic')
      .select(BASIC_COLUMNS)
      .eq('talent_user_id', talentId)
      .maybeSingle();

    onboarding_progress.basic_profile_completed = isBasicProfileMandatoryComplete(
      (basic as Record<string, any> | null) ?? null,
      {
        full_name: ((data.linked_talent as any)?.full_name as string | null) ?? null,
        languages_spoken: (data.linked_talent as any)?.languages_spoken,
      },
    );

    const { data: profiles } = await supabaseAdmin
      .from('talent_profiles')
      .select('id, status')
      .eq('talent_user_id', talentId)
      .is('deleted_at', null);

    // Job profile stage ticks only when the talent has at least one
    // profile in `pending_review` or `approved` — drafts and rejected
    // profiles do not count.
    const submittedStatuses = (profiles ?? []).filter(
      (p: any) => p.status === 'approved' || p.status === 'pending_review',
    );
    onboarding_progress.job_profile_completed = submittedStatuses.length > 0;

    if (profiles && profiles.length > 0) {
      const profileIds = profiles.map((p: any) => p.id);
      const { count } = await supabaseAdmin
        .from('portfolio_items')
        .select('id', { count: 'exact', head: true })
        .in('profile_id', profileIds);

      onboarding_progress.portfolio_completed = (count ?? 0) > 0;
    }
  }

  return { ...data, onboarding_progress };
}

// ---------------------------------------------------------------------------
// Update status (admin)
// ---------------------------------------------------------------------------

export async function updateLeadStatus(
  id: string,
  input: UpdateLeadStatusInput,
  adminUserId: string | null,
  options: { source?: 'admin' | 'crm_webhook' } = {}
) {
  const update: Record<string, unknown> = {
    status: input.status,
    status_changed_by: adminUserId,
    status_changed_at: new Date().toISOString(),
  };

  // admin_notes only overwritten when provided (so transitioning without note keeps previous)
  if (input.admin_notes !== undefined) {
    update.admin_notes = input.admin_notes;
  }

  // Archive-specific field; clear it if moving out of archived
  if (input.status === 'archived') {
    update.archive_reason = input.archive_reason ?? null;
  } else {
    update.archive_reason = null;
  }

  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to update lead: ${error.message}`);

  const talentId = (data as any)?.linked_talent_user_id as string | null;
  if (talentId) {
    try {
      await supabaseAdmin
        .from('talent_users')
        .update({ is_active: input.status === 'live' })
        .eq('id', talentId);
    } catch (err) {
      console.error('[lead] failed to sync talent_users.is_active:', err);
    }
  }

  if (input.status === 'shortlisted') {
    try {
      const { onLeadShortlisted } = await import('./automation.service.js');
      await onLeadShortlisted(id, adminUserId);
    } catch (err) {
      console.error('[automation] onLeadShortlisted failed:', err);
    }
  }

  try {
    const { onLeadStatusChanged } = await import('./automation.service.js');
    await onLeadStatusChanged(id, input.status, adminUserId, { source: options.source });
  } catch (err) {
    console.error('[automation] onLeadStatusChanged failed:', err);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Update profile type (admin)
// ---------------------------------------------------------------------------

export async function updateLeadProfileType(
  id: string,
  input: UpdateLeadProfileTypeInput
) {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .update({
      profile_type: input.profile_type ?? null,
      profile_type_custom:
        input.profile_type === 'custom' ? input.profile_type_custom ?? null : null,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to update profile type: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Notes (admin)
// ---------------------------------------------------------------------------

export async function listLeadNotes(leadId: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_notes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, `Failed to fetch notes: ${error.message}`);
  return data ?? [];
}

export async function createLeadNote(
  leadId: string,
  content: string,
  adminUserId: string,
  authorEmail: string | null = null,
  authorName: string | null = null
) {
  const { data, error } = await supabaseAdmin
    .from('lead_notes')
    .insert({ lead_id: leadId, content, created_by: adminUserId, author_email: authorEmail, author_name: authorName })
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to create note: ${error.message}`);
  return data;
}

export async function updateLeadNote(noteId: string, content: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_notes')
    .update({ content })
    .eq('id', noteId)
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Note not found');
    throw new AppError(500, `Failed to update note: ${error.message}`);
  }
  return data;
}

export async function deleteLeadNote(noteId: string) {
  const { error } = await supabaseAdmin
    .from('lead_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw new AppError(500, `Failed to delete note: ${error.message}`);
  return { success: true };
}

/** The candidate category (form_type) of a lead. Returns null if not found. */
export async function getLeadFormType(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('form_type')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to resolve lead: ${error.message}`);
  return (data?.form_type as string | undefined) ?? null;
}

/**
 * The candidate category (form_type) a note belongs to, via its lead. Lets
 * SquadHub authorise note edit/delete by the note's REAL category rather than a
 * client-supplied hint. Returns null when the note (or its lead) is missing.
 */
export async function getLeadNoteFormType(noteId: string): Promise<string | null> {
  const { data: note, error } = await supabaseAdmin
    .from('lead_notes')
    .select('lead_id')
    .eq('id', noteId)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to resolve note: ${error.message}`);
  if (!note?.lead_id) return null;

  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('lead_submissions')
    .select('form_type')
    .eq('id', note.lead_id)
    .maybeSingle();
  if (leadErr) throw new AppError(500, `Failed to resolve note category: ${leadErr.message}`);
  return lead?.form_type ?? null;
}

// ---------------------------------------------------------------------------
// Soft-delete / Restore / Permanent delete (admin)
// ---------------------------------------------------------------------------

export async function softDeleteLead(id: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Lead not found or already deleted');
    throw new AppError(500, `Failed to delete lead: ${error.message}`);
  }
  return data;
}

export async function restoreLead(id: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Lead not found or not deleted');
    throw new AppError(500, `Failed to restore lead: ${error.message}`);
  }
  return data;
}

// Returns the union of top-level form_data keys across recent (non-deleted)
// leads of a given form_type, with a `kind` hint and sample values per key.
// Used by the admin filter UI to discover what fields can be filtered on.
//
// `kind` is:
//   'scalar' — single value (string / number / boolean).
//   'array'  — jsonb array of strings (multi-select fields like
//              work_type_seeking, languages, district). The filter UI maps
//              this to jsonb @> [value] semantics.
//
// If a field appears as both shapes across rows (data drift), the last write
// wins on `kind`; we surface samples from both shapes either way.
export async function getLeadFormFields(formType?: string, sampleSize = 100) {
  let qb = supabaseAdmin
    .from('lead_submissions')
    .select('form_data')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(sampleSize);
  if (formType) qb = qb.eq('form_type', formType);
  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);

  const sampleMap = new Map<string, { samples: Set<string>; kind: 'scalar' | 'array' }>();
  for (const row of data ?? []) {
    const fd = (row as { form_data: Record<string, unknown> | null }).form_data ?? {};
    for (const [key, value] of Object.entries(fd)) {
      if (value === null || value === undefined) continue;
      const isArray = Array.isArray(value);
      // Skip plain objects (not arrays) — they don't fit the simple filter UI.
      if (!isArray && typeof value === 'object') continue;
      const entry = sampleMap.get(key) ?? { samples: new Set<string>(), kind: 'scalar' as 'scalar' | 'array' };
      if (isArray) {
        entry.kind = 'array';
        for (const elem of value as unknown[]) {
          if (elem === null || elem === undefined) continue;
          if (typeof elem === 'object') continue;
          if (entry.samples.size < 20) entry.samples.add(String(elem));
        }
      } else {
        if (entry.samples.size < 10) entry.samples.add(String(value));
      }
      sampleMap.set(key, entry);
    }
  }

  const fields = Array.from(sampleMap.entries())
    .map(([field, { samples, kind }]) => ({
      field,
      kind,
      sample_values: Array.from(samples).slice(0, kind === 'array' ? 20 : 10),
    }))
    .sort((a, b) => a.field.localeCompare(b.field));
  return fields;
}

export async function permanentlyDeleteLead(id: string) {
  // Only allow permanent delete on already-soft-deleted rows to prevent
  // accidental hard-deletes from the main list.
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .delete()
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Lead not found or not in recycle bin');
    throw new AppError(500, `Failed to permanently delete lead: ${error.message}`);
  }
  return data;
}
