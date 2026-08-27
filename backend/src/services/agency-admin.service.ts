import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export interface AgencyListFilters {
  search?: string;
  approval_status?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

function isMissingColumn(err: any) {
  const m = String(err?.message || err || '').toLowerCase();
  return m.includes('column') && m.includes('does not exist');
}

export async function getAgencyStats() {
  let data: any[] | null = null;
  let error: any = null;
  ({ data, error } = await supabaseAdmin.from('agency_users').select('approval_status, is_active, suspended'));
  if (error && isMissingColumn(error)) {
    ({ data, error } = await supabaseAdmin.from('agency_users').select('approval_status'));
  }
  if (error && String(error.code) === '42P01') return { total: 0, by_status: {}, pending: 0, approved: 0, rejected: 0, active: 0, suspended: 0 };
  if (error) throw new AppError(500, error.message);
  const rows = (data ?? []) as any[];
  const byStatus: Record<string, number> = {};
  let total = rows.length;
  let active = 0;
  let suspendedCount = 0;
  for (const r of rows) {
    const s = r.approval_status ?? 'pending';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (r.is_active && !r.suspended) active++;
    else if (r.is_active === undefined && !r.suspended) active++; // fallback when col missing
    if (r.suspended) suspendedCount++;
  }
  return {
    total,
    by_status: byStatus,
    pending: byStatus['pending'] ?? 0,
    approved: byStatus['approved'] ?? 0,
    rejected: byStatus['rejected'] ?? 0,
    active,
    suspended: suspendedCount,
  };
}

export async function listAgencies(filters: AgencyListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  let qb = supabaseAdmin.from('agency_users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  if (filters.approval_status) qb = qb.eq('approval_status', filters.approval_status);
  if (filters.is_active !== undefined) qb = qb.eq('is_active', filters.is_active);
  if (filters.search) {
    const s = filters.search.trim();
    if (s) {
      const like = `%${s.replace(/[%_]/g, '\\$&')}%`;
      const digits = s.replace(/\D/g, '').slice(-10);
      if (digits.length >= 7) {
        // search by phone digits as well
        qb = qb.or(`agency_name.ilike.${like},email.ilike.${like},contact_person.ilike.${like},phone.ilike.%${digits}%`);
      } else {
        qb = qb.or(`agency_name.ilike.${like},email.ilike.${like},contact_person.ilike.${like}`);
      }
    }
  }

  const { data, error, count } = await qb;
  if (error) throw new AppError(500, error.message);
  return { agencies: data ?? [], total: count ?? 0, page, limit, total_pages: Math.ceil((count ?? 0) / limit) };
}

export async function getAgencyDetail(agencyId: string) {
  const { data: agency, error } = await supabaseAdmin.from('agency_users').select('*').eq('id', agencyId).single();
  if (error || !agency) throw new AppError(404, 'Agency not found');

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(agencyId);
  const emailFromAuth = authUser?.user?.email ?? null;

  const [profileRes, squadRes, memberProfilesRes, generalRes] = await Promise.all([
    supabaseAdmin.from('agency_profiles').select('*').eq('agency_user_id', agencyId).maybeSingle(),
    supabaseAdmin.from('agency_squad_members').select('*').eq('agency_user_id', agencyId).order('created_at', { ascending: true }),
    supabaseAdmin.from('agency_member_profiles').select('*, category:category_id(id,name,slug)').eq('agency_user_id', agencyId).is('deleted_at', null),
    supabaseAdmin.from('agency_general_portfolios').select('*, category:category_id(id,name,slug)').eq('agency_user_id', agencyId).is('deleted_at', null),
  ]);

  // Portfolio items (limit 100)
  let portfolioItems: any[] = [];
  try {
    const { data } = await supabaseAdmin.from('agency_portfolio_items').select('*').eq('agency_user_id', agencyId).order('created_at', { ascending: false }).limit(100);
    portfolioItems = data ?? [];
  } catch (_) {
    portfolioItems = [];
  }

  // Duplicate diagnostics via detailed function
  let duplicates: any[] = [];
  try {
    const phoneDigits = (agency.phone ?? agency.whatsapp_number ?? '').replace(/\D/g, '').slice(-10);
    const email = agency.email ?? agency.contact_email ?? emailFromAuth;
    const { data } = await supabaseAdmin.rpc('check_contact_exists_detailed', {
      p_email: email ?? null,
      p_phone_digits: phoneDigits.length === 10 ? phoneDigits : null,
    });
    // filter out self
    duplicates = (data ?? []).filter((d: any) => d.record_id !== agencyId);
  } catch (_) {
    duplicates = [];
  }

  return {
    agency: { ...agency, auth_email: emailFromAuth },
    profile: profileRes.data ?? null,
    squad_members: squadRes.data ?? [],
    member_profiles: (memberProfilesRes.data ?? []) as any[],
    general_portfolios: (generalRes.data ?? []) as any[],
    portfolio_items: portfolioItems,
    duplicates,
  };
}

export async function approveAgency(agencyId: string, adminId: string) {
  for (const attempt of [true, false]) {
    const patch: any = { approval_status: 'approved', approved_at: new Date().toISOString(), ...(attempt ? { approved_by: adminId, rejected_at: null, rejection_reason: null } : {}) };
    const { data, error } = await supabaseAdmin.from('agency_users').update(patch).eq('id', agencyId).eq('approval_status', 'pending').select('*').single();
    if (!error && data) return data;
    if (error && isMissingColumn(error) && attempt) continue;
    throw new AppError(400, error?.message || 'Agency not found or not pending');
  }
  throw new AppError(400, 'Agency not found or not pending');
}

export async function rejectAgency(agencyId: string, adminId: string, reason: string) {
  if (!reason?.trim()) throw new AppError(400, 'Rejection reason is required');
  for (const attempt of [true, false]) {
    const patch: any = { approval_status: 'rejected', ...(attempt ? { rejected_at: new Date().toISOString(), approved_by: adminId, rejection_reason: reason.trim() } : { rejection_reason: reason.trim() }) };
    const { data, error } = await supabaseAdmin.from('agency_users').update(patch).eq('id', agencyId).eq('approval_status', 'pending').select('*').single();
    if (!error && data) return data;
    if (error && isMissingColumn(error) && attempt) continue;
    throw new AppError(400, error?.message || 'Agency not found or not pending');
  }
  throw new AppError(400, 'Agency not found or not pending');
}

export async function bulkApproveAgencies(ids: string[], adminId: string) {
  const results = await Promise.all(ids.map(id => approveAgency(id, adminId).then(d => ({ id, success: true, data: d })).catch(e => ({ id, success: false, error: e.message }))));
  return results;
}

export async function checkDuplicate(params: { email?: string; phone?: string; excludeId?: string }) {
  const email = params.email?.trim().toLowerCase() || null;
  const phoneDigits = params.phone ? params.phone.replace(/\D/g, '').slice(-10) : null;
  const normalizedPhone = phoneDigits && phoneDigits.length === 10 ? phoneDigits : null;

  if (!email && !normalizedPhone) return { exists: false, duplicates: [], summary: 'No email or phone provided' };

  let duplicates: any[] = [];
  try {
    const { data, error } = await supabaseAdmin.rpc('check_contact_exists_detailed', {
      p_email: email,
      p_phone_digits: normalizedPhone,
    });
    if (error) {
      if (String(error.code) === 'PGRST202' || String(error.message).includes('does not exist')) {
        // detailed function not migrated yet — fallback to simple
        const { data: simple } = await supabaseAdmin.rpc('check_contact_exists', { p_email: email, p_phone_digits: normalizedPhone });
        const src = (simple ?? [])[0]?.source;
        if (src) return { exists: true, duplicates: [{ source: src, matched_field: 'email/phone', record_id: '', display_name: src }], sources: [src], quick_source: src, email_checked: email, phone_checked: normalizedPhone };
        return { exists: false, duplicates: [], sources: [], quick_source: null, email_checked: email, phone_checked: normalizedPhone };
      }
      throw error;
    }
    duplicates = (data ?? []).filter((d: any) => !params.excludeId || d.record_id !== params.excludeId);
  } catch (e: any) {
    if (e instanceof AppError) throw e;
    // simple fallback
    try {
      const { data: simple } = await supabaseAdmin.rpc('check_contact_exists', { p_email: email, p_phone_digits: normalizedPhone });
      const src = (simple ?? [])[0]?.source;
      if (src) return { exists: true, duplicates: [{ source: src, matched_field: 'email/phone', record_id: '', display_name: src }], sources: [src], quick_source: src, email_checked: email, phone_checked: normalizedPhone };
    } catch (_) {}
    throw new AppError(500, e.message);
  }

  const exists = duplicates.length > 0;
  // also quick source check for legacy compatibility
  let quickSource: string | null = null;
  if (exists) {
    const sources = [...new Set(duplicates.map((d: any) => d.source))];
    quickSource = sources.join(', ');
  }

  return {
    exists,
    duplicates,
    sources: [...new Set(duplicates.map((d: any) => d.source))],
    quick_source: quickSource,
    email_checked: email,
    phone_checked: normalizedPhone,
  };
}

export async function updateAgency(agencyId: string, patch: Record<string, any>) {
  const allowed = ['agency_name','agency_short_name','contact_person','contact_email','email','phone','whatsapp_number','website','description','location','logo_url','is_active'];
  let updates: Record<string, any> = {};
  for (const k of allowed) if (patch[k] !== undefined) updates[k] = patch[k];
  if (Object.keys(updates).length === 0) throw new AppError(400, 'Nothing to update');
  // retry without new columns if migration not applied
  for (let attempt = 0; attempt < 2; attempt++) {
    const tryUpdates = { ...updates, updated_at: new Date().toISOString() };
    if (attempt === 1) { delete (tryUpdates as any).is_active; delete (tryUpdates as any).agency_short_name; delete (tryUpdates as any).contact_email; delete (tryUpdates as any).whatsapp_number; }
    const { data, error } = await supabaseAdmin.from('agency_users').update(tryUpdates).eq('id', agencyId).select('*').single();
    if (!error && data) return data;
    if (error && isMissingColumn(error) && attempt === 0) { updates = { ...updates }; continue; }
    if (error && !isMissingColumn(error)) throw new AppError(500, error.message);
  }
  throw new AppError(404, 'Agency not found');
}

export async function setAgencyActive(agencyId: string, isActive: boolean) {
  const { data, error } = await supabaseAdmin.from('agency_users').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', agencyId).select('id, is_active').single();
  if (error) {
    if (isMissingColumn(error)) throw new AppError(400, 'is_active column not migrated yet — apply 00129');
    throw new AppError(404, 'Agency not found');
  }
  if (!data) throw new AppError(404, 'Agency not found');
  return data;
}

export async function suspendAgency(agencyId: string, suspend: boolean, reason?: string | null) {
  const { data, error } = await supabaseAdmin.from('agency_users').update({
    suspended: suspend,
    suspended_at: suspend ? new Date().toISOString() : null,
    suspended_reason: suspend ? (reason ?? null) : null,
  }).eq('id', agencyId).select('id, suspended').single();
  if (error || !data) throw new AppError(404, 'Agency not found');
  // mirror to auth metadata if possible
  try { await supabaseAdmin.auth.admin.updateUserById(agencyId, { user_metadata: { suspended: suspend } }); } catch (_) {}
  return { id: data.id, suspended: data.suspended, message: suspend ? 'Agency suspended' : 'Agency unsuspended' };
}

export async function blacklistAgency(agencyId: string, blacklist: boolean, reason?: string | null) {
  const { data, error } = await supabaseAdmin.from('agency_users').update({
    blacklisted: blacklist,
    blacklisted_at: blacklist ? new Date().toISOString() : null,
    blacklisted_reason: blacklist ? (reason ?? null) : null,
  }).eq('id', agencyId).select('id, blacklisted').single();
  if (error || !data) throw new AppError(404, 'Agency not found');
  try { await supabaseAdmin.auth.admin.updateUserById(agencyId, { user_metadata: { blacklisted: blacklist } }); } catch (_) {}
  return { id: data.id, blacklisted: data.blacklisted, message: blacklist ? 'Agency blacklisted' : 'Agency unblacklisted' };
}

export async function deleteAgency(agencyId: string) {
  // Try agency_users first; on success also delete auth user
  const { data: agency, error: fetchErr } = await supabaseAdmin.from('agency_users').select('id').eq('id', agencyId).maybeSingle();
  if (fetchErr) throw new AppError(500, fetchErr.message);
  if (agency) {
    const { error } = await supabaseAdmin.from('agency_users').delete().eq('id', agencyId);
    if (error) throw new AppError(400, error.message);
  }
  // best-effort delete auth
  try { await supabaseAdmin.auth.admin.deleteUser(agencyId); } catch (_) {}
  return { message: 'Agency deleted' };
}

export async function getPendingAgencies() {
  const { data, error } = await supabaseAdmin.from('agency_users').select('*').eq('approval_status', 'pending').order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  return data ?? [];
}
