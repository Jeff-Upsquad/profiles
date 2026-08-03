'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BusinessNotificationsBell from '@/components/jobs/business/BusinessNotificationsBell';

const NAV_ITEMS = [
  {
    href: '/business/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/business/hire',
    label: 'Find',
    // Match legacy deep links under the unified Find talent hub.
    matchPrefixes: [
      '/business/hire',
      '/business/subscription',
      '/business/assignments',
      '/business/job-posts',
    ],
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/business/talent-access',
    label: 'All profiles',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/business/how-it-works',
    label: 'How it works',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function BusinessBottomNav() {
  const pathname = usePathname() ?? '';

  const isActive = (href: string, matchPrefixes?: string[]) => {
    if (matchPrefixes?.length) {
      return matchPrefixes.some(
        (p) => pathname === p || pathname.startsWith(p + '/'),
      );
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Spacer for the fixed icon row only (user strip moved to top profile menu). */}
      <div className="h-[64px] md:hidden" />
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <nav className="mx-auto flex max-w-lg items-center justify-around py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, item.matchPrefixes);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-[#0a0a0a]'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                <span className={active ? 'text-[#0a0a0a]' : ''}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <BusinessNotificationsBell
            variant="bottom"
            active={isActive('/business/notifications')}
          />
        </nav>
      </div>
    </>
  );
}
