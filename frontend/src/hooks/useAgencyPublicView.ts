import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface AgencyPublicViewData {
  agency: {
    id: string;
    agency_name: string;
    agency_short_name: string | null;
    logo_url: string | null;
    contact_person: string | null;
    contact_email: string | null;
    profile: {
      tagline: string | null;
      about: string | null;
      founded_year: number | null;
      team_size: string | null;
      services: string[] | null;
      languages: string[] | null;
      location_country: string | null;
      location_state: string | null;
      location_district: string | null;
      location_city: string | null;
      address: string | null;
      pincode: string | null;
    } | null;
  };
  category: any | null;
  members: any[];
  member_profiles: any[];
  general_portfolios: any[];
  portfolio_items: any[];
  individuals: Array<{ member: any; member_profile: any; category: any | null }>;
  total_items: number;
  total_members_for_category: number;
}

export function useAgencyPublicView(agencyId: string | undefined, categoryId?: string) {
  return useQuery<AgencyPublicViewData>({
    queryKey: ['agency-public-view', agencyId, categoryId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryId) params.set('category_id', categoryId);
      const qs = params.toString();
      const { data } = await api.get(`/business/agency-view/${agencyId}${qs ? `?${qs}` : ''}`);
      return data;
    },
    enabled: !!agencyId,
  });
}

export function useAgencyMemberPublicView(agencyId: string | undefined, memberId: string | undefined) {
  return useQuery({
    queryKey: ['agency-member-public-view', agencyId, memberId],
    queryFn: async () => {
      const { data } = await api.get(`/business/agency-view/${agencyId}/members/${memberId}`);
      return data;
    },
    enabled: !!agencyId && !!memberId,
  });
}
