'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CourseList from '@/views/training/CourseList';
import SopList from '@/views/training/SopList';

type Tab = 'courses' | 'sops';

function TrainingPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initial = (searchParams.get('tab') === 'sops' ? 'sops' : 'courses') as Tab;
  const [tab, setTab] = useState<Tab>(initial);

  const tabs = useMemo(
    () =>
      [
        { id: 'courses' as const, label: 'Courses' },
        { id: 'sops' as const, label: 'Systems & Procedures' },
      ] as const,
    [],
  );

  const select = (id: Tab) => {
    setTab(id);
    const qs = id === 'sops' ? '?tab=sops' : '';
    router.replace(`/training${qs}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Training Program</h1>
      </div>
      <div className="mb-6 flex w-fit gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'courses' ? <CourseList hideHeading /> : <SopList />}
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-gray-100" />}>
      <TrainingPageInner />
    </Suspense>
  );
}
