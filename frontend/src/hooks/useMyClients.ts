import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface MyClientRow {
  recipient_id: string;
  card_id: string;
  external_id: string;
  selected_at: string;
  subscription_activated_at: string | null;
  brand_name: string | null;
  business_nature: string | null;
  plan_name: string | null;
  subscription_name: string | null;
  monthly_price: number | null;
  currency: string | null;
  price_label: string | null;
  hours_label: string | null;
  working_days: string[] | null;
  custom_deliverables: Array<Record<string, unknown>>;
}

export interface MyClientsResponse {
  selected: MyClientRow[];
  assigned: MyClientRow[];
  earnings: { monthly_total: number; currency: string };
  commitment: { hours_per_day: number; hours_per_week: number; hours_per_month: number };
}

export function useMyClients() {
  return useQuery({
    queryKey: ['my-clients'],
    queryFn: async () => {
      const { data } = await api.get<MyClientsResponse>('/talent/subscriptions/my-clients');
      return data;
    },
    staleTime: 60_000,
  });
}
