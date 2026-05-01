'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Top horizontal pill nav for business pages — Dashboard, My subscription,
 * All profiles. Sticky just under the navbar so it's always reachable.
 */
export default function BusinessMobileNav() {
  const pathname = usePathname() ?? '';

  const dashboardActive =
    pathname === '/business/dashboard' || pathname.startsWith('/business/dashboard/');
  const subscriptionActive = pathname.startsWith('/business/subscription');
  const allProfilesActive = pathname.startsWith('/business/all-profiles');

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-gray-200 bg-white shadow-sm md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Pill href="/business/dashboard" active={dashboardActive}>
          Dashboard
        </Pill>
        <Pill href="/business/subscription" active={subscriptionActive}>
          My subscription
        </Pill>
        <Pill href="/business/all-profiles" active={allProfilesActive}>
          All profiles
        </Pill>
      </div>
    </div>
  );
}

function Pill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </Link>
  );
}
