import { supabaseAdmin } from '../config/supabase.js';

export async function getPublicForms() {
  const { data, error } = await supabaseAdmin
    .from('public_forms')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

export async function toggleFormEnabled(id: string, enabled: boolean) {
  const { data, error } = await supabaseAdmin
    .from('public_forms')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAutoApprovalRules(formId: string) {
  const { data, error } = await supabaseAdmin
    .from('public_forms')
    .select('id, form_type, auto_approval_rules')
    .eq('id', formId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateAutoApprovalRules(formId: string, rules: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from('public_forms')
    .update({ auto_approval_rules: rules })
    .eq('id', formId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function isFormEnabled(formType: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('public_forms')
    .select('enabled')
    .eq('form_type', formType)
    .single();

  if (error || !data) return false;
  return data.enabled;
}
