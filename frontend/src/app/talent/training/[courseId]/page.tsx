'use client';

import { Suspense } from 'react';
import TrainingProgram from '@/views/talent/TrainingProgram';

/**
 * The course reader lives on its own route so it can be deep-linked, use the
 * browser's Back button, and claim the full content width — DashboardLayout
 * gives `/talent/training/<id>` the same full-bleed shell a message thread gets.
 */
export default function CourseReaderPage() {
  return (
    <Suspense fallback={<div className="h-full animate-pulse bg-[#f0f0f0]" />}>
      <TrainingProgram />
    </Suspense>
  );
}
