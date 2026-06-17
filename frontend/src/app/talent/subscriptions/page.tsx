'use client';

import TalentOffersView from '@/components/subscriptions/TalentOffersView';

// Talent Subscriptions module — recurring-plan offers. The feed body is shared
// with the Assignments module (TalentOffersView, driven by `variant`).
export default function SubscriptionsPage() {
  return <TalentOffersView variant="subscription" />;
}
