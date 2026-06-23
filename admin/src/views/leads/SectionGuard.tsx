'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import LeadsTabs from './LeadsTabs';

/**
 * Gates a Candidates sub-section (interviews / onboarding) by the staff user's
 * allowed sections. Defense-in-depth: the backend already 403s the data calls,
 * and the tab is hidden — this catches direct-URL navigation cleanly.
 */
export default function SectionGuard({
  section,
  children,
}: {
  section: string;
  children: ReactNode;
}) {
  const { canCandidateSection } = useAuth();
  if (!canCandidateSection(section)) {
    return (
      <div className="space-y-6">
        <LeadsTabs />
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
          <p className="text-sm text-gray-500">You don&apos;t have access to this section.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
