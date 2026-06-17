'use client';

import TalentOffersView from '@/components/subscriptions/TalentOffersView';

// Talent Assignments module — one-off freelance project offers. Shares the
// feed body with Subscriptions (TalentOffersView), filtered to card_type=assignment.
export default function TalentAssignmentsPage() {
  return <TalentOffersView variant="assignment" />;
}
