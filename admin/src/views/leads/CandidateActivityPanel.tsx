'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { groupItemsByBucket } from '@/lib/groupLeadsByBucket';

type ActivityCategory =
  | 'pipeline'
  | 'onboarding'
  | 'interview'
  | 'card'
  | 'note'
  | 'account'
  | 'comms'
  | 'system';

interface ActivityItem {
  id: string;
  type: string;
  category: ActivityCategory;
  title: string;
  description?: string | null;
  actor?: string | null;
  timestamp: string;
}

interface Props {
  /** Provide exactly one of leadId / talentUserId. */
  leadId?: string | null;
  talentUserId?: string | null;
  /** Subject name shown in the header. */
  title?: string | null;
  onClose: () => void;
}

// Per-category dot colour + a compact glyph. Kept presentational — the server
// decides which category each activity belongs to.
const CATEGORY_STYLE: Record<
  ActivityCategory,
  { ring: string; text: string; icon: React.ReactNode }
> = {
  pipeline: {
    ring: 'bg-indigo-100 text-indigo-600',
    text: 'text-indigo-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    ),
  },
  onboarding: {
    ring: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  interview: {
    ring: 'bg-purple-100 text-purple-600',
    text: 'text-purple-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    ),
  },
  card: {
    ring: 'bg-amber-100 text-amber-600',
    text: 'text-amber-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    ),
  },
  note: {
    ring: 'bg-gray-200 text-gray-600',
    text: 'text-gray-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 12v6.75A2.25 2.25 0 0117.25 21H6.75A2.25 2.25 0 014.5 18.75V8.25A2.25 2.25 0 016.75 6H12" />
    ),
  },
  account: {
    ring: 'bg-emerald-100 text-emerald-600',
    text: 'text-emerald-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    ),
  },
  comms: {
    ring: 'bg-teal-100 text-teal-600',
    text: 'text-teal-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    ),
  },
  system: {
    ring: 'bg-slate-200 text-slate-600',
    text: 'text-slate-600',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    ),
  },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CandidateActivityPanel({ leadId, talentUserId, title, onClose }: Props) {
  const subjectId = leadId ?? talentUserId ?? null;

  useEffect(() => {
    if (!subjectId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [subjectId, onClose]);

  const { data: activity = [], isLoading, isError } = useQuery<ActivityItem[]>({
    queryKey: ['candidate-activity', leadId ?? null, talentUserId ?? null],
    queryFn: async () => {
      const url = leadId
        ? `/admin/leads/${leadId}/activity`
        : `/admin/users/${talentUserId}/activity`;
      const { data } = await api.get(url);
      return data.activity as ActivityItem[];
    },
    enabled: !!subjectId,
  });

  // groupItemsByBucket keys off `created_at`; map our timestamp onto it.
  const buckets = useMemo(
    () => groupItemsByBucket(activity.map((a) => ({ ...a, created_at: a.timestamp }))),
    [activity]
  );

  if (!subjectId) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 transition-opacity" onClick={onClose} />
      {/* Panel */}
      <aside className="relative flex w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
            {title && <p className="truncate text-xs text-gray-500">{title}</p>}
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : isError ? (
            <p className="py-8 text-center text-sm text-gray-500">Couldn&apos;t load activity.</p>
          ) : activity.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-gray-700">No activity yet</p>
              <p className="mt-1 text-xs text-gray-500">
                Actions on this candidate will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {buckets.map((bucket) => (
                <section key={bucket.key}>
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {bucket.label}
                    </h3>
                    <span className="text-xs text-gray-400">{bucket.items.length}</span>
                    <div className="ml-1 h-px flex-1 bg-gray-200" />
                  </div>

                  <ul>
                    {bucket.items.map((item, idx) => {
                      const style = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.system;
                      const isLast = idx === bucket.items.length - 1;
                      return (
                        <li key={item.id} className="relative flex gap-3 pb-4">
                          {/* connector line */}
                          {!isLast && (
                            <span className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200" aria-hidden />
                          )}
                          <div
                            className={`relative z-[1] flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${style.ring}`}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              {style.icon}
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1 pt-1">
                            <p className="text-sm font-medium text-gray-900">{item.title}</p>
                            {item.description && (
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-gray-600 line-clamp-4">
                                {item.description}
                              </p>
                            )}
                            <p className="mt-0.5 text-xs text-gray-400">
                              {formatTime(item.timestamp)}
                              {item.actor ? ` · ${item.actor}` : ''}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}
