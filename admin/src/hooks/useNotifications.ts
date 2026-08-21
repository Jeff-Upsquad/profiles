import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

export type NotificationMediaItem =
  | { type: 'image'; url: string; name?: string }
  | { type: 'pdf'; url: string; name?: string }
  | { type: 'loom'; url: string; name?: string };

export type NotificationFilters = {
  approval_status?: Array<'pending' | 'approved' | 'rejected'>;
  is_active?: boolean;
  gender?: string[];
  languages?: string[];
  location_contains?: string;
};

export interface AdminNotification {
  id: string;
  kind: 'broadcast' | 'system';
  system_type: string | null;
  title: string;
  body: string | null;
  media: NotificationMediaItem[];
  link_url: string | null;
  target_filters: NotificationFilters | null;
  created_by: string | null;
  created_at: string;
  recipient_count: number;
  read_count: number;
}

export function useAdminNotifications() {
  return useQuery<AdminNotification[]>({
    queryKey: ['admin', 'notifications'],
    queryFn: async () => {
      const { data } = await api.get('/admin/notifications');
      return data;
    },
  });
}

export function usePreviewRecipients() {
  return useMutation({
    mutationFn: async (filters: NotificationFilters): Promise<{ count: number }> => {
      const { data } = await api.post('/admin/notifications/preview', { filters });
      return data;
    },
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      body?: string;
      media: NotificationMediaItem[];
      filters: NotificationFilters;
      link_url?: string;
    }) => {
      const { data } = await api.post('/admin/notifications', payload);
      return data as AdminNotification;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      toast.success(`Sent to ${n.recipient_count} talent ${n.recipient_count === 1 ? 'user' : 'users'}`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send notification'),
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/notifications/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'notifications'] });
      toast.success('Notification deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });
}
