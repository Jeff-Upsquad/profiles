import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

export interface Webinar {
  id: string;
  title: string;
  starts_at: string;
  language: string;
  meeting_link: string;
  audience: 'all' | 'thailand';
  status: 'draft' | 'published' | 'cancelled';
  created_at: string;
  registrations?: number;
}

export interface WebinarForm {
  title: string;
  starts_at: string;
  language: string;
  meeting_link: string;
  audience: 'all' | 'thailand';
  status: 'draft' | 'published' | 'cancelled';
}

const webinarsKey = ['admin', 'training', 'webinars'];

export function useWebinars() {
  return useQuery<Webinar[]>({
    queryKey: webinarsKey,
    queryFn: async () => {
      const { data } = await api.get('/admin/training/webinars');
      return data;
    },
  });
}

export function useCreateWebinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: WebinarForm) => {
      const { data } = await api.post('/admin/training/webinars', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webinarsKey });
      toast.success('Webinar created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create webinar'),
  });
}

export function useUpdateWebinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<WebinarForm> & { id: string }) => {
      const { data } = await api.put(`/admin/training/webinars/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webinarsKey });
      toast.success('Webinar saved');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save webinar'),
  });
}

export function useRescheduleWebinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; starts_at: string; meeting_link?: string; notify: boolean }) => {
      const { data } = await api.post(`/admin/training/webinars/${id}/reschedule`, payload);
      return data as { webinar: Webinar; notified: number };
    },
    onSuccess: ({ notified }) => {
      qc.invalidateQueries({ queryKey: webinarsKey });
      toast.success(
        notified > 0
          ? `Webinar rescheduled — ${notified} registered talent${notified === 1 ? '' : 's'} notified`
          : 'Webinar rescheduled',
      );
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to reschedule webinar'),
  });
}

export function useDeleteWebinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/training/webinars/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: webinarsKey });
      toast.success('Webinar deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete webinar'),
  });
}
