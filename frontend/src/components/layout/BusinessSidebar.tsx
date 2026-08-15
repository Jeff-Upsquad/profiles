'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import BusinessNotificationsBell from '@/components/jobs/business/BusinessNotificationsBell';
import { useHasAssignedCard } from '@/components/business/cards/hireActivity';
import { useConversationUnread } from '@/hooks/useConversations';

export default function BusinessSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  const { user, logout } = useAuth();

  // Find talent is the business home (dashboard merged in). Highlight legacy list routes too.
  const hireActive =
    pathname.startsWith('/business/hire') ||
    pathname === '/business/dashboard' ||
    pathname.startsWith('/business/subscription') ||
    pathname.startsWith('/business/assignments') ||
    pathname.startsWith('/business/job-posts');
  const cardsActive = pathname.startsWith('/business/cards');
  const allProfilesActive = pathname.startsWith('/business/talent-access');
  const notificationsActive = pathname.startsWith('/business/notifications');
  const messagesActive = pathname.startsWith('/business/messages');
  const howItWorksActive = pathname.startsWith('/business/how-it-works');
  const squadHubActive = pathname.startsWith('/business/squadhub');
  // Once the first card is assigned, this slot becomes the SquadHub gateway and
  // the guide moves into My Cards (see BusinessMyCards).
  const { hasAssignedCard } = useHasAssignedCard();
  const { data: unreadMessages = 0 } = useConversationUnread('business');

  const displayName =
    (user?.role === 'business' && user?.contact_person_name) || user?.full_name || user?.email || '';
  const displayEmail = (user?.role === 'business' && user?.contact_email) || user?.email || '';
  const displayPhone = user?.role === 'business' ? user?.contact_phone : undefined;

  return (
    <div className="flex h-full w-72 flex-col border-r border-gray-200 bg-white md:w-56">
      {/* Brand */}
      <Link
        href="/business/hire"
        onClick={onNavigate}
        className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-4"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a] text-[11px] font-bold text-white">
          SH
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
            SquadHire
          </span>
          <span className="text-[10px] text-[#737373]">Powered by UpSquad</span>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        <SidebarLink
          href="/business/hire"
          active={hireActive}
          onNavigate={onNavigate}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          }
        >
          Find talent
        </SidebarLink>

        <SidebarLink
          href="/business/cards"
          active={cardsActive}
          onNavigate={onNavigate}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          }
        >
          My Cards
        </SidebarLink>

        <SidebarLink
          href="/business/talent-access"
          active={allProfilesActive}
          onNavigate={onNavigate}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        >
          All profiles
        </SidebarLink>

        <SidebarLink
          href="/business/messages"
          active={messagesActive}
          onNavigate={onNavigate}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          }
        >
          Messages
          {unreadMessages > 0 && (
            <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold text-white">
              {unreadMessages}
            </span>
          )}
        </SidebarLink>

        <BusinessNotificationsBell
          variant="sidebar"
          active={notificationsActive}
          onNavigate={onNavigate}
        />

        {hasAssignedCard ? (
          <SidebarLink
            href="/business/squadhub"
            active={squadHubActive}
            onNavigate={onNavigate}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM13 6a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2V6zM4 15a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3zM13 15a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2h-3a2 2 0 01-2-2v-3z"
                />
              </svg>
            }
          >
            SquadHub
          </SidebarLink>
        ) : (
          <SidebarLink
            href="/business/how-it-works"
            active={howItWorksActive}
            onNavigate={onNavigate}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            How it works
          </SidebarLink>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        {user && (
          <div className="mb-2 px-1">
            {displayName && (
              <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
            )}
            {displayEmail && (
              <p className="truncate text-[11px] text-zinc-500">{displayEmail}</p>
            )}
            {displayPhone && (
              <p className="truncate text-[11px] text-zinc-500">{displayPhone}</p>
            )}
          </div>
        )}
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  active,
  onNavigate,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-[#F5F5F6] text-[#0a0a0a]'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
