'use client';

import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import {
  useBusinessNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type BusinessNotification,
} from '@/hooks/useBusinessNotifications';
import { fmtDateTime } from '@/components/jobs/shared';

// Business notifications inbox — written by the jobs services (applications,
// RSVPs, offer responses, questions…). Click-through lands on the job post.

function targetHref(n: BusinessNotification): string | null {
  const cardId = typeof n.ref?.card_id === 'string' ? n.ref.card_id : null;
  if (!cardId) return null;
  const roundId = typeof n.ref?.round_id === 'string' ? n.ref.round_id : null;
  if (roundId) return `/business/job-posts/${cardId}/rounds/${roundId}`;
  return `/business/job-posts/${cardId}`;
}

function iconFor(type: string): React.ReactNode {
  if (type.includes('interview')) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (type.includes('offer')) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (type.includes('question')) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

export default function BusinessNotificationsView() {
  const router = useRouter();
  const { data: notifications, isLoading, isError } = useBusinessNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const list = notifications ?? [];
  const unread = list.filter((n) => !n.read_at).length;

  const handleClick = (n: BusinessNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    const href = targetHref(n);
    if (href) router.push(href);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#0a0a0a] sm:text-[30px] stagger-2">
              Notifications
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Applications, interview RSVPs, offer responses and candidate questions.
            </p>
          </div>
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>
      </section>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#f0f0f0]" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Could not load notifications.</p>
        </div>
      )}

      {!isLoading && !isError && list.length === 0 && (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
            <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
            Nothing yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
            You&apos;ll see candidate activity on your job posts here.
          </p>
        </div>
      )}

      {!isLoading && !isError && list.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <ul className="divide-y divide-[#E7E7EA]">
            {list.map((n) => {
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-[#F5F5F6] ${
                      isUnread ? 'bg-[#FFFDF0]' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isUnread ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#F1F1F3] text-[#737373]'
                      }`}
                    >
                      {iconFor(n.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${isUnread ? 'font-semibold text-[#0a0a0a]' : 'font-medium text-[#525252]'}`}
                      >
                        {n.title}
                      </p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#737373]">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-[#a3a3a3]">{fmtDateTime(n.created_at)}</p>
                    </div>
                    {isUnread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0a0a0a]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
