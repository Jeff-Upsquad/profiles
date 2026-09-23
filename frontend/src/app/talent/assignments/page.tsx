'use client';

import TalentOffersView from '@/components/subscriptions/TalentOffersView';
import PartnerLockedView from '@/components/partner/PartnerLockedView';
import { usePartnerAccess } from '@/hooks/usePartnerProgram';

// Talent Assignments module — one-off freelance project offers. Shares the
// feed body with Subscriptions (TalentOffersView), filtered to card_type=assignment.
// Non-partners get the read-only preview of the same pool instead.
export default function TalentAssignmentsPage() {
  const { locked } = usePartnerAccess();
  if (locked) return <PartnerLockedView variant="assignment" />;
  return <TalentOffersView variant="assignment" />;
}
