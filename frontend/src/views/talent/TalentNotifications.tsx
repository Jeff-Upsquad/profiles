import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { SkeletonCard } from '@/components/ui/Skeleton';

interface Notification {
  id: string;
  type: 'interest_request' | 'profile_approved' | 'profile_rejected';
  message: string;
  read: boolean;
  created_at: string;
}

const TYPE_META: Record<Notification['type'], { tint: string; icon: React.ReactNode; label: string }> = {
  interest_request: {
    tint: 'tint-purple',
    label: 'Interest',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  profile_approved: {
    tint: 'tint-green',
    label: 'Approved',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  profile_rejected: {
    tint: 'tint-pink',
    label: 'Rejected',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TalentNotifications() {
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
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Compact Hero */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              <span className="text-rainbow">Notifications</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Profile status updates and interest requests from brands.
            </p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2FCBC]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              No notifications yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              You'll see updates here when brands express interest or your profile status changes.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <ul className="divide-y divide-[#E8E5DE]">
            {notifications.map((notif, i) => {
              const meta = TYPE_META[notif.type] ?? TYPE_META.interest_request;
              return (
                <li
                  key={notif.id}
                  className={`group relative flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[#F7F6F3] stagger-${Math.min(i + 1, 6)}`}
                >
                  {!notif.read && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
                  )}
                  <div
                    className={`${meta.tint} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ml-3`}
                    style={{ color: 'var(--tint-icon)' }}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${notif.read ? 'text-[#525252]' : 'text-[#0a0a0a] font-medium'}`}>
                      {notif.message}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="font-[family-name:var(--font-inter)] font-semibold uppercase tracking-wide" style={{ color: 'var(--tint-icon)' }}>
                        {meta.label}
                      </span>
                      <span className="text-[#a3a3a3]">·</span>
                      <span className="text-[#a3a3a3]">{relativeTime(notif.created_at)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
