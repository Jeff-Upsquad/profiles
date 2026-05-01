'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BusinessSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';

  const dashboardActive =
    pathname === '/business/dashboard' || pathname.startsWith('/business/dashboard/');
  const subscriptionActive = pathname.startsWith('/business/subscription');
  const allProfilesActive = pathname.startsWith('/business/all-profiles');

  return (
    <div className="flex h-full w-72 flex-col border-r border-gray-200 bg-white md:w-56">
      <nav className="flex flex-1 flex-col overflow-y-auto p-3">
        <SidebarLink
          href="/business/dashboard"
          active={dashboardActive}
          onNavigate={onNavigate}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          }
        >
          Dashboard
        </SidebarLink>

        <SidebarLink
          href="/business/subscription"
          active={subscriptionActive}
          onNavigate={onNavigate}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          }
        >
          My subscription
        </SidebarLink>

        <SidebarLink
          href="/business/all-profiles"
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
      </nav>
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
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
