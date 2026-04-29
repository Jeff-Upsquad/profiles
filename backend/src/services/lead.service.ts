import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { evaluateAutoApproval, parseConfig } from './auto-approval.service.js';
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

export async function getLeadSubmissions(filters: {
  form_type?: string;
  status?: string;
  profile_type?: string;
  search?: string;
  role?: string;
  signed_up?: string;
  deleted?: string;
  page?: number;
  limit?: number;
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
    .select('*, linked_talent:linked_talent_user_id(id, full_name)')
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
