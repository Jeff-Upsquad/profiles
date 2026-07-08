import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';

// Business in-app notifications — /api/business/notifications
// (business_notifications, written by the jobs services; read by the bell).

export interface BusinessNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /** {card_id, candidate_id, round_id, offer_id, question_id, job_profile_id, route} */
  ref: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export function useBusinessNotifications(enabled = true) {
  return useQuery<BusinessNotification[]>({
    queryKey: ['business-notifications', 'list'],
    queryFn: async () => {
      const { data } = await api.get<{ notifications: BusinessNotification[] }>(
        '/business/notifications',
      );
      return data.notifications ?? [];
    },
    enabled,
  });
}

export function useBusinessNotificationsUnreadCount(opts: { enabled?: boolean } = {}) {
  return useQuery<number>({
    queryKey: ['business-notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ unread: number }>('/business/notifications/unread-count');
      return data.unread ?? 0;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    enabled: opts.enabled ?? true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.post(`/business/notifications/${notificationId}/read`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ updated: number }>('/business/notifications/mark-all-read');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-notifications'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to mark all read');
    },
  });
}
