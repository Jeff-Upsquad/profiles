import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface ShortlistEntry {
  id: string;
  business_user_id: string;
  company_name: string;
  contact_person_name: string;
  contact_email: string;
  talent_profile_id: string;
  talent_name: string;
  category_id: string;
  category_name: string;
  shortlisted_at: string;
  tier: 'junior' | 'pro' | 'elite' | 'custom' | null;
  tier_custom: string | null;
}

export function useShortlistTracking(categoryId?: string) {
  return useQuery<ShortlistEntry[]>({
    queryKey: ['admin', 'shortlists', categoryId],
    queryFn: async () => {
      const params = categoryId ? `?category_id=${categoryId}` : '';
      const { data } = await api.get(`/admin/shortlists${params}`);
      return data.shortlists ?? data;
    },
  });
}
