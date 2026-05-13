// Per-admin saved filter presets for the Candidates (lead) list.
// Filters are JSON blobs whose shape is owned by the admin frontend; the backend
// only stores them. `form_type` scopes a preset to a category so the dropdown
// can show only the relevant ones on each Candidates page.

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export interface SavedFilterRow {
  id: string;
  admin_user_id: string;
  name: string;
  form_type: string | null;
  filter_json: unknown;
  created_at: string;
  updated_at: string;
}

export async function listSavedLeadFilters(adminUserId: string, formType?: string) {
  let qb = supabaseAdmin
    .from('admin_saved_lead_filters')
    .select('*')
    .eq('admin_user_id', adminUserId)
    .order('updated_at', { ascending: false });
  if (formType) qb = qb.eq('form_type', formType);
  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);
  return (data ?? []) as SavedFilterRow[];
}

export async function createSavedLeadFilter(input: {
  adminUserId: string;
  name: string;
  formType: string | null;
  filterJson: unknown;
}) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, 'Filter name is required');
  const { data, error } = await supabaseAdmin
    .from('admin_saved_lead_filters')
    .insert({
      admin_user_id: input.adminUserId,
      name,
      form_type: input.formType,
      filter_json: input.filterJson,
    })
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  return data as SavedFilterRow;
}

export async function updateSavedLeadFilter(
  id: string,
  adminUserId: string,
  patch: { name?: string; filterJson?: unknown }
) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new AppError(400, 'Filter name cannot be empty');
    update.name = trimmed;
  }
  if (patch.filterJson !== undefined) update.filter_json = patch.filterJson;

  const { data, error } = await supabaseAdmin
    .from('admin_saved_lead_filters')
    .update(update)
    .eq('id', id)
    .eq('admin_user_id', adminUserId)
    .select('*')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Saved filter not found');
  return data as SavedFilterRow;
}

export async function deleteSavedLeadFilter(id: string, adminUserId: string) {
  const { error, count } = await supabaseAdmin
    .from('admin_saved_lead_filters')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('admin_user_id', adminUserId);
  if (error) throw new AppError(500, error.message);
  if (!count) throw new AppError(404, 'Saved filter not found');
  return { ok: true };
}
