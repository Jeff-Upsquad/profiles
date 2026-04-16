import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { CreateLeadInput, UpdateLeadStatusInput } from '../validators/lead.validators.js';

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
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .update({
      status: input.status,
      admin_notes: input.admin_notes ?? null,
      status_changed_by: adminUserId,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to update lead: ${error.message}`);
  return data;
}
