'use client';

import { Suspense } from 'react';
import OnboardingList from '@/views/leads/OnboardingList';
import SectionGuard from '@/views/leads/SectionGuard';

export default function OnboardingPage() {
  return (
    <SectionGuard section="onboarding">
      <Suspense>
        <OnboardingList />
      </Suspense>
    </SectionGuard>
  );
}
