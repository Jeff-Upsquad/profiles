'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const TABS = [
  { href: '/leads', label: 'Applications', section: 'applications' },
  { href: '/leads/interviews', label: 'Interview Responses', section: 'interviews' },
  { href: '/leads/onboarding', label: 'Onboarding', section: 'onboarding' },
];

export default function LeadsTabs() {
  const pathname = usePathname();
  const { canCandidateSection } = useAuth();
  const tabs = TABS.filter((tab) => canCandidateSection(tab.section));

  return (
    <div className="flex gap-2 border-b border-gray-200">
      {tabs.map((tab) => {
        const active =
          tab.href === '/leads'
            ? pathname === '/leads'
            : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
