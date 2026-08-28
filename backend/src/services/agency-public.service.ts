import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as agencyService from './agency.service.js';

/**
 * Public view for agencies — mirrors talent ThreadsProfileView but for agencies.
 * Portfolio section has two tabs:
 *  - All: combined agency general portfolio + all squad member portfolios for the category
 *  - Individuals: list of squad members who have a profile for that category
 *
 * Category filtering: if categoryId is provided, only portfolios/members for that
 * category are returned. This matches requirement-card filtering (designer card → designer portfolios only).
 */

export interface AgencyPublicViewOptions {
  categoryId?: string;
}

export async function getAgencyPublicView(agencyId: string, opts: AgencyPublicViewOptions = {}) {
  // Fetch agency user + profile + category (if filtering)
  const [agencyUser, agencyProfile, category] = await Promise.all([
    agencyService.getAgencyUser(agencyId),
    agencyService.getAgencyProfile(agencyId),
    opts.categoryId
      ? supabaseAdmin.from('categories').select('id, name, slug').eq('id', opts.categoryId).maybeSingle().then(r => r.data)
      : Promise.resolve(null),
  ]);

  if (!agencyUser) throw new AppError(404, 'Agency not found');

  // Validate category exists if filtering
  if (opts.categoryId && !category) throw new AppError(404, 'Category not found');

  // Fetch squad members, member profiles, general portfolios, and portfolio items
  const [squadMembers, memberProfiles, generalPortfolios] = await Promise.all([
    agencyService.listSquadMembers(agencyId),
    agencyService.listMemberProfiles(agencyId),
    agencyService.listGeneralPortfolios(agencyId),
  ]);

  // Filter by category if requested
  const filteredMemberProfiles = opts.categoryId
    ? memberProfiles.filter((p: any) => p.category_id === opts.categoryId)
    : memberProfiles;
  const filteredGeneralPortfolios = opts.categoryId
    ? generalPortfolios.filter((p: any) => p.category_id === opts.categoryId)
    : generalPortfolios;

  // Collect relevant profile/portfolio ids for filtering items
  const memberProfileIds = filteredMemberProfiles.map((p: any) => p.id);
  const generalPortfolioIds = filteredGeneralPortfolios.map((p: any) => p.id);

  // Fetch portfolio items — filter in JS to avoid complex OR query
  let allItems: any[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('agency_portfolio_items')
      .select('*')
      .eq('agency_user_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(200);
    allItems = data ?? [];
  } catch (e: any) {
    if (agencyService.isMissingTable(e)) allItems = [];
    else throw e;
  }

  // Filter items to the requested category's portfolios
  const filteredItems = allItems.filter((it: any) => {
    if (opts.categoryId) {
      // Item must belong to a relevant member profile or general portfolio
      if (it.member_profile_id && memberProfileIds.includes(it.member_profile_id)) return true;
      if (it.general_portfolio_id && generalPortfolioIds.includes(it.general_portfolio_id)) return true;
      return false;
    }
    return true;
  });

  // Enrich items with member info for "All" tab lightbox (show member name)
  const memberByProfileId = new Map<string, any>();
  for (const mp of filteredMemberProfiles) {
    const member = squadMembers.find((m: any) => m.id === mp.squad_member_id);
    if (member) memberByProfileId.set(mp.id, member);
  }
  const generalByPortfolioId = new Map<string, any>();
  for (const gp of filteredGeneralPortfolios) generalByPortfolioId.set(gp.id, gp);

  const enrichedItems = filteredItems.map((it: any) => {
    if (it.member_profile_id) {
      const member = memberByProfileId.get(it.member_profile_id);
      const mp = filteredMemberProfiles.find((p: any) => p.id === it.member_profile_id);
      return {
        ...it,
        member_id: member?.id ?? null,
        member_name: member?.full_name ?? null,
        member_photo_url: member?.profile_photo_url ?? member?.profile_picture_url ?? null,
        category_id: mp?.category_id ?? null,
        category_name: (mp?.category as any)?.name ?? null,
      };
    }
    if (it.general_portfolio_id) {
      const gp = generalByPortfolioId.get(it.general_portfolio_id);
      return {
        ...it,
        member_id: null,
        member_name: null,
        category_id: gp?.category_id ?? null,
        category_name: (gp?.category as any)?.name ?? null,
      };
    }
    return it;
  });

  // Build "Individuals" tab data: members who have a profile for this category
  const individuals = filteredMemberProfiles.map((mp: any) => {
    const member = squadMembers.find((m: any) => m.id === mp.squad_member_id);
    return {
      member: member ?? null,
      member_profile: mp,
      category: (mp as any).category ?? null,
    };
  }).filter((x: any) => x.member);

  // Also fetch category fields for detail rendering (like talent view)
  let categoryWithFields: any = category;
  if (opts.categoryId) {
    const { data: catFull } = await supabaseAdmin
      .from('categories')
      .select('*, category_fields!category_id(*, field_options(*))')
      .eq('id', opts.categoryId)
      .maybeSingle();
    if (catFull) {
      const rawFields = (catFull as any).category_fields ?? [];
      (catFull as any).fields = rawFields.filter((f: any) => f.is_active).map((f: any) => ({
        ...f,
        options: (f.field_options ?? []).filter((o: any) => o.is_active),
      }));
      delete (catFull as any).category_fields;
      categoryWithFields = catFull;
    }
  }

  return {
    agency: {
      id: agencyUser.id,
      agency_name: agencyUser.agency_name,
      agency_short_name: agencyUser.agency_short_name ?? agencyUser.short_form ?? null,
      logo_url: agencyUser.logo_url ?? null,
      contact_person: agencyUser.contact_person ?? null,
      contact_email: agencyUser.contact_email ?? agencyUser.email ?? null,
      profile: agencyProfile ? {
        tagline: agencyProfile.tagline,
        about: agencyProfile.about,
        founded_year: agencyProfile.founded_year,
        team_size: agencyProfile.team_size,
        services: agencyProfile.services,
        languages: agencyProfile.languages ?? [],
        location_country: agencyProfile.location_country,
        location_state: agencyProfile.location_state,
        location_district: agencyProfile.location_district,
        location_city: agencyProfile.location_city,
        address: agencyProfile.address,
        pincode: agencyProfile.pincode,
      } : null,
    },
    category: categoryWithFields ?? null,
    members: squadMembers,
    member_profiles: filteredMemberProfiles,
    general_portfolios: filteredGeneralPortfolios,
    // For "All" tab
    portfolio_items: enrichedItems,
    // For "Individuals" tab
    individuals,
    // Meta
    total_items: enrichedItems.length,
    total_members_for_category: individuals.length,
  };
}

export async function getAgencyMemberPublicView(agencyId: string, memberId: string) {
  const [squadMembers, memberProfiles] = await Promise.all([
    agencyService.listSquadMembers(agencyId),
    agencyService.listMemberProfiles(agencyId),
  ]);
  const member = squadMembers.find((m: any) => m.id === memberId);
  if (!member) throw new AppError(404, 'Squad member not found');

  const profiles = memberProfiles.filter((p: any) => p.squad_member_id === memberId);
  const agencyUser = await agencyService.getAgencyUser(agencyId);

  // Portfolio items for this member
  let items: any[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('agency_portfolio_items')
      .select('*')
      .eq('agency_user_id', agencyId)
      .in('member_profile_id', profiles.map((p: any) => p.id))
      .order('created_at', { ascending: false });
    items = data ?? [];
  } catch (e: any) {
    if (!agencyService.isMissingTable(e)) throw e;
  }

  return {
    agency: {
      id: agencyUser.id,
      agency_name: agencyUser.agency_name,
      logo_url: agencyUser.logo_url,
    },
    member,
    member_profiles: profiles,
    portfolio_items: items,
  };
}
