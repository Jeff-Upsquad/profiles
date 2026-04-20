'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/leads', label: 'Applications' },
  { href: '/leads/interviews', label: 'Interview Responses' },
];

export default function LeadsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 border-b border-gray-200">
      {TABS.map((tab) => {
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
