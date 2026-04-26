import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
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
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
    })
    .select('id')
    .single();

  if (error) throw new AppError(500, `Failed to create lead: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// List (admin)
// ---------------------------------------------------------------------------

export async function getLeadSubmissions(filters: {
  form_type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('lead_submissions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.form_type) {
    query = query.eq('form_type', filters.form_type);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
    );
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
// Detail (admin)
// ---------------------------------------------------------------------------

export async function getLeadSubmission(id: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new AppError(404, 'Lead not found');
  return data;
}

// ---------------------------------------------------------------------------
// Update status (admin)
// ---------------------------------------------------------------------------

export async function updateLeadStatus(
  id: string,
  input: UpdateLeadStatusInput,
  adminUserId: string
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
  adminUserId: string
) {
  const { data, error } = await supabaseAdmin
    .from('lead_notes')
    .insert({ lead_id: leadId, content, created_by: adminUserId })
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
