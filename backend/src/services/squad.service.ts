import { supabaseAdmin, supabaseAnon } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { memSquad, memProfiles, memMemberProfiles, isMissingTable } from './agency.service.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

// ---------------------------------------------------------------------------
// Agency creates invite for squad member / manager
// ---------------------------------------------------------------------------
export async function createSquadInvite(agencyUserId: string, input: { full_name: string; email: string; role_type: 'member'|'manager' }) {
  const email = input.email.trim().toLowerCase();
  // check duplicate email in squad for this agency
  try {
    const { data: existing } = await supabaseAdmin.from('agency_squad_members').select('id').eq('agency_user_id', agencyUserId).eq('invite_email', email).maybeSingle();
    if (existing) throw new AppError(409, 'An invite for this email already exists');
  } catch (e:any) {
    if (e instanceof AppError) throw e;
    // if table missing, check mem
    if (isMissingTable(e)) {
      const arr = memSquad.get(agencyUserId) || [];
      if (arr.find((m:any)=> (m.invite_email||m.email||'').toLowerCase()===email)) throw new AppError(409, 'An invite for this email already exists');
    }
  }
  const row: any = {
    agency_user_id: agencyUserId,
    full_name: input.full_name,
    invite_email: email,
    email: email,
    status: 'invited',
    role_type: input.role_type,
    invited_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').insert(row).select('*').single();
    if (error) throw error;
    return data;
  } catch (e:any) {
    if (isMissingTable(e) || String(e.message||'').toLowerCase().includes('column')) {
      const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const memRow = { id, ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const arr = memSquad.get(agencyUserId) || [];
      arr.push(memRow);
      memSquad.set(agencyUserId, arr);
      return memRow;
    }
    throw new AppError(400, e.message);
  }
}

export async function listSquadWithInvites(agencyUserId: string) {
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').select('*').eq('agency_user_id', agencyUserId).order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  } catch (e:any) {
    if (isMissingTable(e)) return memSquad.get(agencyUserId) || [];
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Squad member signup — invited email + password only
// ---------------------------------------------------------------------------
export async function squadSignup(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  // find invite
  let invite: any = null;
  let agencyUserId: string | null = null;
  // try DB first
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').select('*').eq('invite_email', email).eq('status','invited').maybeSingle();
    if (error) throw error;
    invite = data;
    if (invite) agencyUserId = invite.agency_user_id;
  } catch (e:any) {
    if (isMissingTable(e) || String(e.message||'').toLowerCase().includes('column')) {
      // search mem
      for (const [agencyId, arr] of memSquad.entries()) {
        const found = (arr as any[]).find((m:any)=> (m.invite_email||'').toLowerCase()===email && m.status==='invited');
        if (found) { invite = found; agencyUserId = agencyId; break; }
      }
    } else {
      throw e;
    }
  }
  if (!invite) throw new AppError(404, 'No invite found for this email. Ask your agency to invite you.');
  if (invite.status !== 'invited') throw new AppError(400, 'Invite already used');

  const role: UserRole = invite.role_type === 'manager' ? 'squad_manager' as UserRole : 'squad_member' as UserRole;
  const full_name = invite.full_name;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { role, full_name, agency_user_id: agencyUserId },
  });
  if (authError) {
    if (authError.message.includes('already')) throw new AppError(409, 'An account with this email already exists');
    throw new AppError(400, authError.message);
  }
  const userId = authData.user.id;
  // update squad member row to active and link auth user
  const patch: any = { status: 'active', auth_user_id: userId, activated_at: new Date().toISOString() };
  try {
    const { error } = await supabaseAdmin.from('agency_squad_members').update(patch).eq('id', invite.id);
    if (error) throw error;
  } catch (e:any) {
    // fallback mem
    const arr = memSquad.get(agencyUserId!) || [];
    const idx = arr.findIndex((m:any)=> m.id===invite.id);
    if (idx!==-1) { arr[idx] = { ...arr[idx], ...patch }; memSquad.set(agencyUserId!, arr); }
  }
  return { message: 'Account created. Please sign in.' };
}

// ---------------------------------------------------------------------------
// Squad member self-service: get/update own basic profile
// ---------------------------------------------------------------------------
export async function getSquadMe(squadUserId: string) {
  // squadUserId is auth user id, need to find squad member row by auth_user_id
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').select('*').eq('auth_user_id', squadUserId).maybeSingle();
    if (error) throw error;
    if (!data) throw new AppError(404, 'Squad member not found');
    return data;
  } catch (e:any) {
    if (isMissingTable(e)) {
      for (const arr of memSquad.values()) {
        const found = (arr as any[]).find((m:any)=> m.auth_user_id===squadUserId);
        if (found) return found;
      }
      throw new AppError(404, 'Squad member not found');
    }
    if (e instanceof AppError) throw e;
    throw new AppError(500, e.message);
  }
}

export async function updateSquadMe(squadUserId: string, patch: Record<string,any>) {
  const me = await getSquadMe(squadUserId);
  const agencyUserId = me.agency_user_id;
  const memberId = me.id;
  try {
    const { data, error } = await supabaseAdmin.from('agency_squad_members').update(patch).eq('id', memberId).select('*').single();
    if (error) throw error;
    return data;
  } catch (e:any) {
    if (isMissingTable(e) || String(e.message||'').toLowerCase().includes('column')) {
      const arr = memSquad.get(agencyUserId) || [];
      const idx = arr.findIndex((m:any)=> m.id===memberId);
      if (idx===-1) throw new AppError(404, 'Not found');
      arr[idx] = { ...arr[idx], ...patch, updated_at: new Date().toISOString() };
      memSquad.set(agencyUserId, arr);
      return arr[idx];
    }
    throw new AppError(500, e.message);
  }
}

// ---------------------------------------------------------------------------
// Squad job profiles — with agency category restriction
// ---------------------------------------------------------------------------
async function getAgencyAllowedCategoryIds(agencyUserId: string): Promise<Set<string> | null> {
  try {
    let services: string[] | null = null;
    try {
      const { data: profile } = await supabaseAdmin.from('agency_profiles').select('services').eq('agency_user_id', agencyUserId).maybeSingle();
      services = (profile as any)?.services ?? null;
    } catch {}
    const memProf = memProfiles.get(agencyUserId);
    const memServices = memProf?.services ?? null;
    const effectiveServices = services ?? memServices;
    if (!effectiveServices || effectiveServices.length===0) return null;
    try {
      const { data: cats } = await supabaseAdmin.from('categories').select('id,name').in('name', effectiveServices);
      if (cats && cats.length>0) return new Set(cats.map((c:any)=>c.id));
    } catch {}
    return new Set(effectiveServices);
  } catch {
    return null;
  }
}

export async function squadListJobProfiles(squadUserId: string) {
  const me = await getSquadMe(squadUserId);
  try {
    const { data, error } = await supabaseAdmin.from('agency_member_profiles').select('*, category:category_id(id,name,slug)').eq('squad_member_id', me.id).is('deleted_at', null).order('created_at', {ascending:false});
    if (error) throw error;
    return data ?? [];
  } catch (e:any) {
    if (isMissingTable(e)) return memMemberProfiles.filter((p:any)=> p.squad_member_id===me.id);
    throw new AppError(500, e.message);
  }
}

export async function squadCreateJobProfile(squadUserId: string, input: { category_id: string; field_data?: any }) {
  const me = await getSquadMe(squadUserId);
  const agencyUserId = me.agency_user_id;
  const allowed = await getAgencyAllowedCategoryIds(agencyUserId);
  if (allowed && !allowed.has(input.category_id)) {
    throw new AppError(403, 'You can only create profiles for categories your agency offers');
  }
  try {
    const { data, error } = await supabaseAdmin.from('agency_member_profiles').insert({ agency_user_id: agencyUserId, squad_member_id: me.id, category_id: input.category_id, field_data: input.field_data ?? {} }).select('*').single();
    if (error) throw error;
    return data;
  } catch (e:any) {
    if (isMissingTable(e) || String(e.message||'').toLowerCase().includes('column')) {
      const row = { id: `mp-${Date.now()}`, agency_user_id: agencyUserId, squad_member_id: me.id, category_id: input.category_id, field_data: input.field_data ?? {}, status:'draft', created_at: new Date().toISOString() };
      memMemberProfiles.push(row);
      return row;
    }
    if (e instanceof AppError) throw e;
    throw new AppError(400, e.message);
  }
}

export async function squadUpdateJobProfile(squadUserId: string, profileId: string, patch: Record<string,any>) {
  const me = await getSquadMe(squadUserId);
  try {
    const { data, error } = await supabaseAdmin.from('agency_member_profiles').update(patch).eq('id', profileId).eq('squad_member_id', me.id).select('*').single();
    if (error) throw error;
    return data;
  } catch (e:any) {
    if (isMissingTable(e)) {
      const idx = memMemberProfiles.findIndex((p:any)=> p.id===profileId && p.squad_member_id===me.id);
      if (idx===-1) throw new AppError(404, 'Not found');
      memMemberProfiles[idx] = { ...memMemberProfiles[idx], ...patch };
      return memMemberProfiles[idx];
    }
    throw new AppError(500, e.message);
  }
}

export async function squadDeleteJobProfile(squadUserId: string, profileId: string) {
  const me = await getSquadMe(squadUserId);
  try {
    const { error } = await supabaseAdmin.from('agency_member_profiles').update({ deleted_at: new Date().toISOString() }).eq('id', profileId).eq('squad_member_id', me.id);
    if (error) throw error;
    return { message:'Deleted' };
  } catch (e:any) {
    if (isMissingTable(e)) {
      const idx = memMemberProfiles.findIndex((p:any)=> p.id===profileId && p.squad_member_id===me.id);
      if (idx!==-1) memMemberProfiles.splice(idx,1);
      return { message:'Deleted' };
    }
    throw new AppError(500, e.message);
  }
}

export async function squadGetAllowedCategories(squadUserId: string) {
  const me = await getSquadMe(squadUserId);
  const allowed = await getAgencyAllowedCategoryIds(me.agency_user_id);
  if (!allowed) {
    const { data } = await supabaseAdmin.from('categories').select('id,name,slug').eq('is_active', true).order('sort_order');
    return data ?? [];
  }
  const { data } = await supabaseAdmin.from('categories').select('id,name,slug').in('id', Array.from(allowed));
  return data ?? [];
}
