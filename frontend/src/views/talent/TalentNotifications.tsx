import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/formatDate';

type MediaItem =
  | { type: 'image'; url: string; name?: string }
  | { type: 'pdf'; url: string; name?: string }
  | { type: 'loom'; url: string; name?: string };

interface Notification {
  id: string;                  // recipient row id
  notification_id: string;
  kind: 'broadcast' | 'system';
  system_type: 'interest_request' | 'profile_approved' | 'profile_rejected' | null;
  title: string;
  body: string | null;
  media: MediaItem[];
  read: boolean;
  read_at: string | null;
  created_at: string;
}

type Tab = 'all' | 'unread' | 'read';

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function loomEmbedUrl(url: string): string {
  const m = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  return m ? `https://www.loom.com/embed/${m[1]}` : url;
}

function iconForNotification(n: Notification): { tint: string; node: React.ReactNode; label: string } {
  if (n.system_type === 'profile_approved') {
    return {
      tint: 'tint-green',
      label: 'Approved',
      node: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    };
  }
  if (n.system_type === 'profile_rejected') {
    return {
      tint: 'tint-pink',
      label: 'Rejected',
      node: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    };
  }
  if (n.system_type === 'interest_request') {
    return {
      tint: 'tint-purple',
      label: 'Interest',
      node: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    };
  }
  return {
    tint: 'tint-purple',
    label: 'Announcement',
    node: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  };
}

function NotificationMedia({ media }: { media: MediaItem[] }) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {media.map((m, i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-[#E7E7EA]">
          {m.type === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.url}
              alt={m.name ?? 'image'}
              className="w-full max-h-72 object-contain bg-[#F5F5F6]"
            />
          )}
          {m.type === 'pdf' && (
            <a
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 p-3 bg-[#FFF5F4] hover:bg-[#FFEAE7] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100 text-red-600 text-[10px] font-semibold flex-shrink-0">
                  PDF
                </span>
                <span className="text-sm text-[#0a0a0a] truncate">
                  {m.name ?? 'Document.pdf'}
                </span>
              </div>
              <span className="text-xs font-medium text-[#525252] flex-shrink-0">Open</span>
            </a>
          )}
          {m.type === 'loom' && (
            <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={loomEmbedUrl(m.url)}
                className="absolute inset-0 h-full w-full"
                allowFullScreen
                title={m.name ?? 'Loom video'}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TalentNotifications() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('unread');

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
  const readCount = notifications.length - unreadCount;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/talent/notifications/${id}/read`);
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['talent-notifications'] });
      const prev = qc.getQueryData<Notification[]>(['talent-notifications']);
      qc.setQueryData<Notification[]>(['talent-notifications'], (old) =>
        (old ?? []).map((n) =>
          n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n,
        ),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['talent-notifications'], ctx.prev);
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await api.post('/talent/notifications/mark-all-read');
    },
    onSuccess: () => {
      qc.setQueryData<Notification[]>(['talent-notifications'], (old) =>
        (old ?? []).map((n) =>
          n.read ? n : { ...n, read: true, read_at: new Date().toISOString() },
        ),
      );
    },
  });

  const filtered = useMemo(() => {
    if (tab === 'unread') return notifications.filter((n) => !n.read);
    if (tab === 'read') return notifications.filter((n) => n.read);
    return notifications;
  }, [notifications, tab]);

  return (
    <div className="space-y-6">
      {/* Compact Hero */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
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
              Announcements and profile updates from UpSquad.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="self-start sm:self-end inline-flex items-center rounded-full border border-[#E7E7EA] bg-white px-3 py-1.5 text-xs font-medium text-[#0a0a0a] hover:bg-[#F5F5F6] disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-[#E7E7EA] bg-white p-1">
        {([
          ['unread', 'Unread', unreadCount],
          ['all', 'All', notifications.length],
          ['read', 'Read', readCount],
        ] as const).map(([key, label, count]) => (
          <button
            type="button"
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[#0a0a0a] text-white'
                : 'text-[#525252] hover:bg-[#F5F5F6]'
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs ${tab === key ? 'text-white/70' : 'text-[#a3a3a3]'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              {tab === 'unread'
                ? 'No unread notifications'
                : tab === 'read'
                ? 'Nothing read yet'
                : 'No notifications yet'}
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              {tab === 'all'
                ? "You'll see announcements and profile updates here."
                : tab === 'unread'
                ? "You're all caught up."
                : 'Notifications you open will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif, i) => {
            const meta = iconForNotification(notif);
            const hasMedia = (notif.media?.length ?? 0) > 0;
            return (
              <article
                key={notif.id}
                className={`group relative rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-start gap-3 px-5 py-4">
                  {!notif.read && (
                    <span className="absolute left-2 top-5 h-1.5 w-1.5 rounded-full bg-[#0a0a0a]" />
                  )}
                  <div
                    className={`${meta.tint} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ml-3`}
                    style={{ color: 'var(--tint-icon)' }}
                  >
                    {meta.node}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className={`text-sm leading-snug ${notif.read ? 'text-[#525252]' : 'text-[#0a0a0a] font-semibold'}`}>
                          {notif.title}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span
                            className="font-[family-name:var(--font-inter)] font-semibold uppercase tracking-wide"
                            style={{ color: 'var(--tint-icon)' }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[#a3a3a3]">·</span>
                          <span className="text-[#a3a3a3]">{relativeTime(notif.created_at)}</span>
                        </div>
                      </div>
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={() => markRead.mutate(notif.id)}
                          className="text-xs font-medium text-[#525252] hover:text-[#0a0a0a] flex-shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                    {notif.body && (
                      <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${notif.read ? 'text-[#737373]' : 'text-[#404040]'}`}>
                        {notif.body}
                      </p>
                    )}
                    {hasMedia && <NotificationMedia media={notif.media} />}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
