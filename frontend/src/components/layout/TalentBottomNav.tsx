'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConversationUnread } from '@/hooks/useConversations';
import { useUnreadNotificationsCount } from '@/hooks/useNotifications';
import { useIncompleteTrainingCount } from '@/hooks/useTraining';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  matchPrefixes?: string[];
  badge?: number;
}

const HOME_PREFIXES = [
  '/talent/dashboard',
  '/talent/subscriptions',
  '/talent/assignments',
  '/talent/bidding',
  '/talent/job-openings',
];

const MORE_PREFIXES = [
  '/talent/more',
  '/talent/basic-profile',
  '/talent/profiles',
  '/talent/my-clients',
  '/talent/settings',
  '/talent/training',
  '/talent/contact-support',
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0a0a0a] px-1 text-[9px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function TalentBottomNav() {
  const pathname = usePathname() ?? '';
  const { data: unreadMessages = 0 } = useConversationUnread('talent');
  const { data: unreadNotifications = 0 } = useUnreadNotificationsCount();
  const { data: incompleteTraining = 0 } = useIncompleteTrainingCount();

  const navItems: NavItem[] = [
    {
      href: '/talent/dashboard',
      label: 'Home',
      matchPrefixes: HOME_PREFIXES,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/talent/messages',
      label: 'Messages',
      badge: unreadMessages,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      href: '/talent/notifications',
      label: 'Notifications',
      badge: unreadNotifications,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      href: '/talent/more',
      label: 'More',
      matchPrefixes: MORE_PREFIXES,
      badge: incompleteTraining,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string, matchPrefixes?: string[]) => {
    if (matchPrefixes?.length) {
      return matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      <div className="h-[64px] md:hidden" />
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <nav className="mx-auto flex max-w-lg items-center justify-around py-2">
          {navItems.map((item) => {
            const active = isActive(item.href, item.matchPrefixes);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-[#0a0a0a]' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span className="relative">
                  {item.icon}
                  <NavBadge count={item.badge ?? 0} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
