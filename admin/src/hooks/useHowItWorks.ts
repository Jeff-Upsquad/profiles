import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

export interface HowItWorksVideo {
  id: string;
  language: string;
  loom_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useHowItWorksVideos() {
  return useQuery<HowItWorksVideo[]>({
    queryKey: ['admin', 'how-it-works', 'videos'],
    queryFn: async () => {
      const { data } = await api.get('/admin/how-it-works/videos');
      return data;
    },
  });
}

export function useCreateHowItWorksVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { language: string; loom_url: string; is_active?: boolean }) => {
      const { data } = await api.post('/admin/how-it-works/videos', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'how-it-works', 'videos'] });
      toast.success('Video added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add video'),
  });
}

export function useUpdateHowItWorksVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; language?: string; loom_url?: string; is_active?: boolean }) => {
      const { data } = await api.put(`/admin/how-it-works/videos/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'how-it-works', 'videos'] });
      toast.success('Video updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update video'),
  });
}

export function useDeleteHowItWorksVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/how-it-works/videos/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'how-it-works', 'videos'] });
      toast.success('Video deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete video'),
  });
}
