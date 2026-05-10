import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface TalentUserInfo {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  current_location?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  age?: number | null;
  gender?: string | null;
  whatsapp_subscription_updates_enabled?: boolean;
}

export function useTalentMe() {
  return useQuery<TalentUserInfo>({
    queryKey: ['talentMe'],
    queryFn: async () => {
      const { data } = await api.get('/talent/me');
      return data.talent ?? data;
    },
  });
}

export function useUpdateTalentMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<TalentUserInfo>) => {
      const { data } = await api.put('/talent/me', patch);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talentMe'] });
    },
  });
}
