'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMyCategories, useBusinessTalentAccess } from '@/hooks/useBusiness';

/**
 * Horizontally-scrollable pill strip used as the *primary* navigation on
 * mobile for the business app. Replaces the previous drill-down drawer
 * (which was hidden behind a hamburger and required multiple taps to
 * reach the content). Every top-level destination is one tap away here.
 *
 * The strip is sticky just under the navbar so it stays in reach while
 * the user scrolls long content (a card list, profile detail, etc.).
 *
 * Hidden on desktop — there the existing two-panel sidebar already gives
 * direct access. Categories on desktop drive a stateful talent panel,
 * but on mobile we already have a dedicated `/business/dashboard/{id}`
 * route, so each category pill navigates straight there.
 */
export default function BusinessMobileNav() {
  const { data: categories } = useMyCategories();
  const { data: talentAccess } = useBusinessTalentAccess();
  const pathname = usePathname() ?? '';

  // Path → "is this pill active?" — we match on prefix so a profile detail
  // page like `/business/dashboard/{cat}/{id}` keeps that category
  // highlighted, not the bare Dashboard pill.
  const dashboardActive = pathname === '/business/dashboard';
  const talentAccessActive = pathname.startsWith('/business/talent-access');
  const categoryMatch = pathname.match(/^\/business\/dashboard\/([^/]+)/);
  const activeCategoryId =
    categoryMatch && categoryMatch[1] !== 'cards' ? categoryMatch[1] : null;

  // sticky-top:0 — the strip lives inside <main>, which already starts at
  // the navbar's bottom edge. Using top-[60px] here would leave a 60px gap
  // between the navbar and the strip when sticky engages.
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-gray-200 bg-white shadow-sm md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Pill href="/business/dashboard" active={dashboardActive && !activeCategoryId}>
          Dashboard
        </Pill>
        {talentAccess?.has_access && (
          <Pill href="/business/talent-access" active={talentAccessActive}>
            Talents
          </Pill>
        )}
        {(categories ?? []).map((cat) => (
          <Pill
            key={cat.id}
            href={`/business/dashboard/${cat.id}`}
            active={activeCategoryId === cat.id}
          >
            {cat.name}
          </Pill>
        ))}
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
