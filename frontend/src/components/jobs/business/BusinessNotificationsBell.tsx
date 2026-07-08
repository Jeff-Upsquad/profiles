'use client';

import Link from 'next/link';
import { useBusinessNotificationsUnreadCount } from '@/hooks/useBusinessNotifications';

// Notifications bell for the business nav — sidebar row or bottom-nav item,
// both carrying the unread badge.

const BELL_ICON = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

export default function BusinessNotificationsBell({
  variant,
  active,
  onNavigate,
}: {
  variant: 'sidebar' | 'bottom';
  active: boolean;
  onNavigate?: () => void;
}) {
  const { data: unread = 0 } = useBusinessNotificationsUnreadCount();

  if (variant === 'bottom') {
    return (
      <Link
        href="/business/notifications"
        className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
          active ? 'text-[#0a0a0a]' : 'text-zinc-500 hover:text-zinc-900'
        }`}
      >
        <span className="relative">
          {BELL_ICON}
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </span>
        Alerts
      </Link>
    );
  }

  return (
    <Link
      href="/business/notifications"
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-[#F5F5F6] text-[#0a0a0a]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {BELL_ICON}
      <span className="flex-1">Notifications</span>
      {unread > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
