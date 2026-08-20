'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useHasAssignedCard } from '@/components/business/cards/hireActivity';

const SQUADHUB_TIP_KEY = 'business-bottom-nav-squadhub-tip';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Extra route prefixes that should also light this tab up. */
  matchPrefixes?: string[];
}

// The fourth slot is either the How-it-works guide or, once the business has
// its first assigned card, the SquadHub gateway. The guide isn't lost when it's
// swapped out — it moves into My Cards as a section (see BusinessMyCards).
const HOW_IT_WORKS_ITEM: NavItem = {
  href: '/business/how-it-works',
  label: 'How it works',
  icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const SQUADHUB_ITEM: NavItem = {
  href: '/business/squadhub',
  label: 'SquadHub',
  icon: (
    <svg className="h-5 w-5" fill="#FFFF99" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM13 6a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V6zM4 15a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3zM13 15a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3z" />
    </svg>
  ),
};

const NAV_ITEMS: NavItem[] = [
  {
    href: '/business/hire',
    label: 'Find talent',
    // Home + legacy list routes (dashboard home redirects here).
    matchPrefixes: [
      '/business/hire',
      '/business/dashboard',
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
    href: '/business/cards',
    label: 'My Cards',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
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
    href: '/business/messages',
    label: 'Chatroom',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
];

export default function BusinessBottomNav() {
  const pathname = usePathname() ?? '';
  const { hasAssignedCard } = useHasAssignedCard();
  const [showSquadHubTip, setShowSquadHubTip] = useState(false);
  const navItems = [...NAV_ITEMS, hasAssignedCard ? SQUADHUB_ITEM : HOW_IT_WORKS_ITEM];

  useEffect(() => {
    if (!hasAssignedCard) return;
    try {
      if (localStorage.getItem(SQUADHUB_TIP_KEY) !== 'dismissed') {
        setShowSquadHubTip(true);
      }
    } catch {
      setShowSquadHubTip(true);
    }
  }, [hasAssignedCard]);

  // Give the conversation the full viewport — the thread header has a back link.
  if (/^\/business\/messages\/[^/]+/.test(pathname)) return null;

  function dismissSquadHubTip() {
    setShowSquadHubTip(false);
    try {
      localStorage.setItem(SQUADHUB_TIP_KEY, 'dismissed');
    } catch {
      // ignore
    }
  }

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
          {navItems.map((item) => {
            const active = isActive(item.href, item.matchPrefixes);
            const isSquadHub = item.href === SQUADHUB_ITEM.href;

            return (
              <div key={item.href} className="relative">
                <Link
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

                {isSquadHub && showSquadHubTip && (
                  <div
                    className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-sm"
                    style={{ animation: 'squadhub-tip-in 220ms ease-out both' }}
                    role="status"
                  >
                    <div className="relative rounded-xl bg-[#0a0a0a] px-3.5 py-3 text-white shadow-[0_8px_24px_-8px_rgba(10,10,10,0.4)]">
                      <div
                        className="absolute -bottom-1 right-8 h-2.5 w-2.5 rotate-45 bg-[#0a0a0a]"
                        aria-hidden="true"
                      />
                      <div className="flex items-start gap-2.5">
                        <p className="flex-1 font-[family-name:var(--font-inter)] text-[12.5px] font-medium leading-relaxed">
                          Download the SquadHub app or log in on the web to start working with your
                          talent.
                        </p>
                        <button
                          type="button"
                          onClick={dismissSquadHubTip}
                          aria-label="Dismiss tip"
                          className="-mr-1 -mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={dismissSquadHubTip}
                          className="text-[11px] font-semibold text-[#FFFAC2] transition-opacity hover:opacity-80"
                        >
                          Got it
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <style jsx>{`
        @keyframes squadhub-tip-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
