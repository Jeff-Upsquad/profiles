'use client';

import { Suspense } from 'react';
import AgencyTraining from '@/views/agency/AgencyTraining';

/**
 * The agency course reader lives on its own route so it can be deep-linked, use the
 * browser's Back button, and claim the full content width — DashboardLayout
 * gives `/agency/training/<id>` the same full-bleed shell a message thread gets.
 */
export default function AgencyCourseReaderPage() {
  return (
    <Suspense fallback={<div className="h-full animate-pulse bg-[#f0f0f0]" />}>
      <AgencyTraining />
    </Suspense>
  );
}
