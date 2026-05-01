import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface TalentUserInfo {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  current_location?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  age?: number | null;
  gender?: string | null;
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
