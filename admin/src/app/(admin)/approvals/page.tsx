'use client';

import { Suspense } from 'react';
import OnboardingHub from '@/views/onboarding/OnboardingHub';

// Sign-ups + onboarding journey + CRM boards, in one module. Keeps the
// /approvals URL (and the 'approvals' permission slug) it always had.
export default function ApprovalsPage() {
  return (
    <Suspense>
      <OnboardingHub />
    </Suspense>
  );
}
