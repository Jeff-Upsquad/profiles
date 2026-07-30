import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { ServiceType } from '@/constants/connectBriefCategories';

export interface ConnectBriefCountry {
  id: string;
  name: string;
  currency: string;
  sort_order: number;
}

// Country list for the brief form's picker. Proxied through our backend from
// squadhub-web. Cached for the session — the list rarely changes.
export function useConnectBriefCountries(enabled = true) {
  return useQuery<ConnectBriefCountry[]>({
    queryKey: ['connect-brief', 'countries'],
    enabled,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data } = await api.get('/business/connect-brief/countries');
      return (data?.data ?? []) as ConnectBriefCountry[];
    },
  });
}

export interface ConnectBriefRoleRequirement {
  note?: string;
  tiers?: string[];
  plan?: string;
  budget?: number;
  duration?: string;
  pricing_mode?: 'priced' | 'unpriced';
}

export interface ConnectBriefPayload {
  service_types: ServiceType[];
  brand_name: string;
  business_nature: string;
  business_note: string;
  business_location?: string;
  // Contact fields are optional — the backend backfills them from the
  // signed-in business account.
  contact_name?: string;
  email?: string;
  phone?: string;
  country_id: string;
  state_regions?: string[];
  languages: string[];
  working_days?: string[];
  role_requirements?: Partial<Record<ServiceType, ConnectBriefRoleRequirement>>;
  card_type: 'subscription' | 'assignment';
}

// Submit a brief. On success, refresh the card lists so a newly created card
// shows up without a manual reload.
export function useSubmitConnectBrief() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ConnectBriefPayload) => {
      const { data } = await api.post('/business/connect-brief', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-subscription-cards'] });
      queryClient.invalidateQueries({ queryKey: ['my-assignment-cards'] });
    },
  });
}
