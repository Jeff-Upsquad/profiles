import { supabaseAdmin } from '../config/supabase.js';
import { isSocialMediaCreator } from '../../../shared/src/creatorRoles.js';

// Includes older accounts that added a creator profile after signing up in
// another category, as well as creator and mixed-category signups.
export async function socialMediaCreatorIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const source of ['signup', 'profile'] as const) {
    for (let offset = 0; ; offset += 1000) {
      const query = source === 'signup'
        ? supabaseAdmin.from('talent_users').select('id')
          .or('signup_form_type.eq.social_media_creator,signup_categories.cs.{social-media-creator}')
        : supabaseAdmin.from('talent_profiles').select('id, talent_user_id, categories!inner(slug)')
          .eq('categories.slug', 'social-media-creator').is('deleted_at', null);
      const { data, error } = await query.order('id').range(offset, offset + 999);
      if (error) throw new Error(`Creator routing lookup failed: ${error.message}`);
      for (const row of data ?? []) ids.add(source === 'signup' ? row.id : (row as any).talent_user_id);
      if (!data || data.length < 1000) break;
    }
  }
  return ids;
}

export async function isCreatorTalent(talentUserId: string): Promise<boolean> {
  const { data: talent, error } = await supabaseAdmin.from('talent_users')
    .select('signup_form_type, signup_categories').eq('id', talentUserId).maybeSingle();
  if (error) throw new Error(error.message);
  if (isSocialMediaCreator(talent)) return true;
  const { data: profiles, error: profileError } = await supabaseAdmin.from('talent_profiles')
    .select('id, categories!inner(slug)').eq('talent_user_id', talentUserId)
    .eq('categories.slug', 'social-media-creator').is('deleted_at', null).limit(1);
  if (profileError) throw new Error(profileError.message);
  return !!profiles?.length;
}
