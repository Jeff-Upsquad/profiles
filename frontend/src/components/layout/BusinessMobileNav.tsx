'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHasAssignedCard } from '@/components/business/cards/hireActivity';

/**
 * Optional top pill nav for business pages (legacy). Dashboard merged into Find talent.
 */
export default function BusinessMobileNav() {
  const pathname = usePathname() ?? '';

  const hireActive =
    pathname.startsWith('/business/hire') ||
    pathname === '/business/dashboard' ||
    pathname.startsWith('/business/subscription') ||
    pathname.startsWith('/business/assignments') ||
    pathname.startsWith('/business/job-posts');
  const cardsActive = pathname.startsWith('/business/cards');
  const allProfilesActive = pathname.startsWith('/business/talent-access');
  const howItWorksActive = pathname.startsWith('/business/how-it-works');
  const squadHubActive = pathname.startsWith('/business/squadhub');
  // Swapped for the SquadHub gateway once the first card is assigned; the guide
  // then lives inside My Cards (see BusinessMyCards).
  const { hasAssignedCard } = useHasAssignedCard();

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-gray-200 bg-white shadow-sm md:hidden">
      <div className="flex gap-2 overflow-x-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <Pill href="/business/hire" active={hireActive}>
          Find talent
        </Pill>
        <Pill href="/business/cards" active={cardsActive}>
          My Cards
        </Pill>
        <Pill href="/business/talent-access" active={allProfilesActive}>
          All profiles
        </Pill>
        {hasAssignedCard ? (
          <Pill href="/business/squadhub" active={squadHubActive}>
            SquadHub
          </Pill>
        ) : (
          <Pill href="/business/how-it-works" active={howItWorksActive}>
            How it works
          </Pill>
        )}
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
          ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </Link>
  );
}
