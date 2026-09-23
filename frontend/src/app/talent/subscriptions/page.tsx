'use client';

import TalentOffersView from '@/components/subscriptions/TalentOffersView';
import PartnerLockedView from '@/components/partner/PartnerLockedView';
import { usePartnerAccess } from '@/hooks/usePartnerProgram';

// Talent Subscriptions module — recurring-plan offers. The feed body is shared
// with the Assignments module (TalentOffersView, driven by `variant`). Talents
// outside the Partner Program get the read-only preview of the same pool
// instead, with the application form on top.
export default function SubscriptionsPage() {
  const { locked } = usePartnerAccess();
  if (locked) return <PartnerLockedView variant="subscription" />;
  return <TalentOffersView variant="subscription" />;
}
