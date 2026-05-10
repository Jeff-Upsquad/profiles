'use client';

import { Suspense } from 'react';
import OnboardingList from '@/views/leads/OnboardingList';

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingList />
    </Suspense>
  );
}
