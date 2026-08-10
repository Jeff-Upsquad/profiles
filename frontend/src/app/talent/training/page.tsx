'use client';

import { Suspense } from 'react';
import TrainingProgram from '@/views/talent/TrainingProgram';

export default function TrainingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-32 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      }
    >
      <TrainingProgram />
    </Suspense>
  );
}
