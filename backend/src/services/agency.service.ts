import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// In-memory fallback when tables don't exist yet (migration not applied)
export const memAgencies = new Map<string, any>();
export const memProfiles = new Map<string, any>();
export const memSquad = new Map<string, any[]>();
export const memMemberProfiles: any[] = [];
export const memGeneralPortfolios: any[] = [];
export const memPortfolioItems: any[] = [];

export function isMissingTable(err: any) {
  const raw = String(err?.message || '') + ' ' + String(err?.code || '') + ' ' + JSON.stringify(err || {});
  const msg = raw.toLowerCase();
  return msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('could not find') || msg.includes('schema cache') || msg.includes('pgrst205') || msg.includes('42p01');
}

// ---------------------------------------------------------------------------
// Agency User
// ---------------------------------------------------------------------------
export async function getAgencyUser(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_users').select('*').eq('id', userId).single();
    if (error) throw error;
    const mem = memAgencies.get(userId);
    return mem ? { ...data, ...mem } : data;
  } catch (e: any) {
    if (isMissingTable(e)) return memAgencies.get(userId) || { id: userId, agency_name: 'Demo Agency', email: '', role: 'agency' };
    throw new AppError(500, e.message || 'Failed to fetch agency');
  }
}

export async function updateAgencyUser(userId: string, patch: Record<string, any>) {
  // keep in-memory cache in sync even when DB succeeds (for new columns not yet migrated)
  const curMem = memAgencies.get(userId) || {};
  memAgencies.set(userId, { ...curMem, ...patch, id: userId });
  try {
    const { data, error } = await supabaseAdmin.from('agency_users').update(patch).eq('id', userId).select('*').single();
    if (error) throw error;
    const mem = memAgencies.get(userId);
    return mem ? { ...data, ...mem } : data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const cur = memAgencies.get(userId) || { id: userId, agency_name: 'Agency' };
      return cur;
    }
    // column missing also falls back to memory (already cached)
    const raw = String((e as any)?.message || '').toLowerCase();
    if (raw.includes('column') || raw.includes('schema cache')) {
      return memAgencies.get(userId) || { id: userId, ...patch };
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Agency Profile (one row per agency)
// ---------------------------------------------------------------------------
export async function getAgencyProfile(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_profiles').select('*').eq('agency_user_id', userId).maybeSingle();
    if (error) throw error;
    const mem = memProfiles.get(userId);
    if (!data && mem) return mem;
    if (data && mem) return { ...data, ...mem };
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) return memProfiles.get(userId) || null;
    throw new AppError(500, e.message);
  }
}

export async function upsertAgencyProfile(userId: string, patch: Record<string, any>) {
  const curMem = memProfiles.get(userId) || { agency_user_id: userId };
  memProfiles.set(userId, { ...curMem, ...patch });
  try {
    const { data, error } = await supabaseAdmin.from('agency_profiles').upsert({ agency_user_id: userId, ...patch }, { onConflict: 'agency_user_id' }).select('*').single();
    if (error) throw error;
    // Backfill cards when agency profile changes (services/languages/location)
    try {
      const { backfillCardsForAgency } = await import('./card-backfill.service.js');
      backfillCardsForAgency(userId).catch((e) => console.error('[card-backfill] agency profile backfill failed', e));
    } catch {}
    const mem = memProfiles.get(userId);
    return mem ? { ...data, ...mem } : data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      return memProfiles.get(userId) || { agency_user_id: userId, ...patch };
    }
    const raw = String((e as any)?.message || '').toLowerCase();
    if (raw.includes('column') || raw.includes('schema cache')) {
      return memProfiles.get(userId) || { agency_user_id: userId, ...patch };
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Squad Members
// ---------------------------------------------------------------------------
export async function listSquadMembers(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').select('*').eq('agency_user_id', userId).order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e: any) {
    if (isMissingTable(e)) return memSquad.get(userId) || [];
    throw new AppError(500, e.message);
  }
}

export async function createSquadMember(userId: string, input: Record<string, any>) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').insert({ agency_user_id: userId, ...input }).select('*').single();
    if (error) throw error;
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const row = { id, agency_user_id: userId, ...input, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const arr = memSquad.get(userId) || [];
      arr.push(row);
      memSquad.set(userId, arr);
      return row;
    }
    throw new AppError(400, e.message);
  }
}

export async function updateSquadMember(userId: string, memberId: string, patch: Record<string, any>) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').update(patch).eq('id', memberId).eq('agency_user_id', userId).select('*').single();
    if (error) throw error;
    if (!data) throw new AppError(404, 'Squad member not found');
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const arr = memSquad.get(userId) || [];
      const idx = arr.findIndex((m: any) => m.id === memberId);
      if (idx === -1) throw new AppError(404, 'Squad member not found');
      arr[idx] = { ...arr[idx], ...patch, updated_at: new Date().toISOString() };
      memSquad.set(userId, arr);
      return arr[idx];
    }
    if (e instanceof AppError) throw e;
    throw new AppError(500, e.message);
  }
}

export async function deleteSquadMember(userId: string, memberId: string) {
  try {
    const { error } = await supabaseAdmin.from('agency_squad_members').delete().eq('id', memberId).eq('agency_user_id', userId);
    if (error) throw error;
    return { message: 'Deleted' };
  } catch (e: any) {
    if (isMissingTable(e)) {
      const arr = (memSquad.get(userId) || []).filter((m: any) => m.id !== memberId);
      memSquad.set(userId, arr);
      return { message: 'Deleted' };
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Member Job Profiles (per squad member + category)
// ---------------------------------------------------------------------------
export async function listMemberProfiles(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_member_profiles').select('*, category:category_id(id,name,slug)').eq('agency_user_id', userId).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e: any) {
    if (isMissingTable(e)) return memMemberProfiles.filter((p: any) => p.agency_user_id === userId);
    throw new AppError(500, e.message);
  }
}

export async function createMemberProfile(userId: string, input: { squad_member_id: string; category_id: string; field_data?: any }) {
  try {
    // verify squad member belongs to agency
    const { data: member } = await supabaseAdmin.from('agency_squad_members').select('id').eq('id', input.squad_member_id).eq('agency_user_id', userId).maybeSingle();
    if (!member && !isMissingTable({ message: '' })) {
      // check mem fallback
      const mem = (memSquad.get(userId) || []).find((m: any) => m.id === input.squad_member_id);
      if (!mem && memSquad.has(userId)) throw new AppError(404, 'Squad member not found');
    }
    const { data, error } = await supabaseAdmin.from('agency_member_profiles').insert({ agency_user_id: userId, squad_member_id: input.squad_member_id, category_id: input.category_id, field_data: input.field_data ?? {} }).select('*').single();
    if (error) throw error;
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const row = { id: `mp-${Date.now()}`, agency_user_id: userId, squad_member_id: input.squad_member_id, category_id: input.category_id, field_data: input.field_data ?? {}, status: 'draft', created_at: new Date().toISOString() };
      memMemberProfiles.push(row);
      return row;
    }
    if (e instanceof AppError) throw e;
    throw new AppError(400, e.message);
  }
}

export async function updateMemberProfile(userId: string, profileId: string, patch: Record<string, any>) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_member_profiles').update(patch).eq('id', profileId).eq('agency_user_id', userId).select('*').single();
    if (error) throw error;
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const idx = memMemberProfiles.findIndex((p: any) => p.id === profileId && p.agency_user_id === userId);
      if (idx === -1) throw new AppError(404, 'Profile not found');
      memMemberProfiles[idx] = { ...memMemberProfiles[idx], ...patch };
      return memMemberProfiles[idx];
    }
    throw new AppError(500, e.message);
  }
}

export async function deleteMemberProfile(userId: string, profileId: string) {
  try {
    const { error } = await supabaseAdmin.from('agency_member_profiles').update({ deleted_at: new Date().toISOString() }).eq('id', profileId).eq('agency_user_id', userId);
    if (error) throw error;
    return { message: 'Deleted' };
  } catch (e: any) {
    if (isMissingTable(e)) {
      const idx = memMemberProfiles.findIndex((p: any) => p.id === profileId);
      if (idx !== -1) memMemberProfiles.splice(idx, 1);
      return { message: 'Deleted' };
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// General Portfolios
// ---------------------------------------------------------------------------
export async function listGeneralPortfolios(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_general_portfolios').select('*, category:category_id(id,name,slug)').eq('agency_user_id', userId).is('deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (e: any) {
    if (isMissingTable(e)) return memGeneralPortfolios.filter((p: any) => p.agency_user_id === userId);
    throw new AppError(500, e.message);
  }
}

export async function createGeneralPortfolio(userId: string, input: { category_id: string; field_data?: any }) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_general_portfolios').insert({ agency_user_id: userId, category_id: input.category_id, field_data: input.field_data ?? {} }).select('*').single();
    if (error) throw error;
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const row = { id: `gp-${Date.now()}`, agency_user_id: userId, category_id: input.category_id, field_data: input.field_data ?? {}, status: 'draft', created_at: new Date().toISOString() };
      memGeneralPortfolios.push(row);
      return row;
    }
    throw new AppError(400, e.message);
  }
}

export async function updateGeneralPortfolio(userId: string, id: string, patch: Record<string, any>) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_general_portfolios').update(patch).eq('id', id).eq('agency_user_id', userId).select('*').single();
    if (error) throw error;
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const idx = memGeneralPortfolios.findIndex((p: any) => p.id === id);
      if (idx === -1) throw new AppError(404, 'Not found');
      memGeneralPortfolios[idx] = { ...memGeneralPortfolios[idx], ...patch };
      return memGeneralPortfolios[idx];
    }
    throw new AppError(500, e.message);
  }
}

export async function deleteGeneralPortfolio(userId: string, id: string) {
  try {
    const { error } = await supabaseAdmin.from('agency_general_portfolios').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('agency_user_id', userId);
    if (error) throw error;
    return { message: 'Deleted' };
  } catch (e: any) {
    if (isMissingTable(e)) {
      const idx = memGeneralPortfolios.findIndex((p: any) => p.id === id);
      if (idx !== -1) memGeneralPortfolios.splice(idx, 1);
      return { message: 'Deleted' };
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Portfolio Items (unified)
// ---------------------------------------------------------------------------
export async function listPortfolioItems(userId: string, filters: { member_profile_id?: string; general_portfolio_id?: string }) {
  try {
    let q = supabaseAdmin.from('agency_portfolio_items').select('*').eq('agency_user_id', userId).order('sort_order', { ascending: true });
    if (filters.member_profile_id) q = q.eq('member_profile_id', filters.member_profile_id);
    if (filters.general_portfolio_id) q = q.eq('general_portfolio_id', filters.general_portfolio_id);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  } catch (e: any) {
    if (isMissingTable(e)) {
      return memPortfolioItems.filter((it: any) => {
        if (it.agency_user_id !== userId) return false;
        if (filters.member_profile_id && it.member_profile_id !== filters.member_profile_id) return false;
        if (filters.general_portfolio_id && it.general_portfolio_id !== filters.general_portfolio_id) return false;
        return true;
      });
    }
    throw new AppError(500, e.message);
  }
}

export async function addPortfolioItem(userId: string, input: { member_profile_id?: string; general_portfolio_id?: string; title?: string; description?: string; file_url?: string; file_type?: string; file_name?: string; category_name?: string | null; skill_name?: string; source_type?: string; provider?: string | null; external_url?: string | null; embed_url?: string | null; thumbnail_url?: string | null }) {
  try {
    const row: any = { agency_user_id: userId, member_profile_id: input.member_profile_id ?? null, general_portfolio_id: input.general_portfolio_id ?? null, title: input.title ?? null, description: input.description ?? null, file_url: input.file_url ?? null, file_type: input.file_type ?? 'video', file_name: input.file_name ?? 'file', category_name: input.category_name ?? null, skill_name: input.skill_name ?? null, source_type: input.source_type ?? 'upload', provider: input.provider ?? null, external_url: input.external_url ?? null, embed_url: input.embed_url ?? null, thumbnail_url: input.thumbnail_url ?? null };
    const { data, error } = await supabaseAdmin.from('agency_portfolio_items').insert(row).select('*').single();
    if (error) throw error;
    return data;
  } catch (e: any) {
    if (isMissingTable(e)) {
      const row = { id: `pi-${Date.now()}`, ...input, agency_user_id: userId, created_at: new Date().toISOString() } as any;
      memPortfolioItems.push(row);
      return row;
    }
    throw new AppError(400, e.message);
  }
}

export async function deletePortfolioItem(userId: string, itemId: string) {
  try {
    const { error } = await supabaseAdmin.from('agency_portfolio_items').delete().eq('id', itemId).eq('agency_user_id', userId);
    if (error) throw error;
    return { message: 'Deleted' };
  } catch (e: any) {
    if (isMissingTable(e)) {
      const idx = memPortfolioItems.findIndex((it: any) => it.id === itemId);
      if (idx !== -1) memPortfolioItems.splice(idx, 1);
      return { message: 'Deleted' };
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Combined portfolio view (total)
// ---------------------------------------------------------------------------
export async function getTotalPortfolio(userId: string) {
  const [members, memberProfiles, generalPortfolios] = await Promise.all([
    listSquadMembers(userId),
    listMemberProfiles(userId),
    listGeneralPortfolios(userId),
  ]);
  let items: any[] = [];
  try {
    const { data } = await supabaseAdmin.from('agency_portfolio_items').select('*').eq('agency_user_id', userId).order('created_at', { ascending: false }).limit(100);
    items = data ?? [];
  } catch (e: any) {
    if (isMissingTable(e)) items = memPortfolioItems.filter((it: any) => it.agency_user_id === userId);
  }
  return { members, member_profiles: memberProfiles, general_portfolios: generalPortfolios, portfolio_items: items };
}
