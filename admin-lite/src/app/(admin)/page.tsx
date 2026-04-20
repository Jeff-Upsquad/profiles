'use client';

import Link from 'next/link';

const cards = [
  {
    href: '/leads',
    title: 'Candidates',
    description: 'Applications from the public intake form. Filter, review, update status.',
  },
  {
    href: '/approvals',
    title: 'Approvals',
    description: 'Pending talent account sign-ups awaiting admin approval.',
  },
  {
    href: '/reviews',
    title: 'Reviews',
    description: 'Submitted talent profiles awaiting review and approval.',
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Focused workflow for candidates, user approvals, and profile reviews.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
          >
            <h2 className="text-base font-semibold text-gray-900">{card.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{card.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
              Open
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
