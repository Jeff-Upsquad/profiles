'use client';

import BusinessSubscription from '@/views/business/BusinessSubscription';

// Freelance Assignment cards for the business — same view as subscriptions,
// driven by the assignment variant (separate list endpoint + copy). Card
// detail / talent review reuse the shared /business/subscription/[cardId] route.
export default function BusinessAssignmentsPage() {
  return <BusinessSubscription variant="assignment" />;
}
