import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Notification {
  id: string;
  type: 'interest_request' | 'profile_approved' | 'profile_rejected';
  message: string;
  read: boolean;
  created_at: string;
}

export default function TalentNotifications() {
  // This would be connected to a real notifications endpoint
  // For now, we show interest requests received
  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ['talent-notifications'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/talent/notifications');
        return data.notifications ?? data ?? [];
      } catch {
        return [];
      }
    },
  });

  const notifications = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Stay updated on your profile status and interest requests.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-gray-900">
            No notifications yet
          </h3>
          <p className="text-sm text-gray-500">
            You'll see notifications here when businesses express interest or your profile status changes.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif.id}
              className={notif.read ? '' : 'border-l-4 border-l-indigo-500'}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-900">{notif.message}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(notif.created_at).toLocaleString()}
                  </p>
                </div>
                {!notif.read && <Badge variant="indigo">New</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
