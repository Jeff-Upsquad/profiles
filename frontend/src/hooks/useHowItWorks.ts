import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export interface HowItWorksVideo {
  id: string;
  language: string;
  loom_url: string;
}

export function useHowItWorksVideos() {
  return useQuery<HowItWorksVideo[]>({
    queryKey: ['howItWorksVideos'],
    queryFn: async () => {
      const { data } = await api.get('/business/how-it-works/videos');
      return data;
    },
  });
}
