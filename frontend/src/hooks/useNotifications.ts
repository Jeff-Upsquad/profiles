import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export function useUnreadNotificationsCount(opts: { enabled?: boolean } = {}) {
  return useQuery<number>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ unread: number }>('/talent/notifications/unread-count');
      return data.unread ?? 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: opts.enabled ?? true,
  });
}
