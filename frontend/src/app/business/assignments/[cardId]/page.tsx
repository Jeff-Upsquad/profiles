'use client';

import { use } from 'react';
import SubscriptionCardReview from '@/views/business/SubscriptionCardReview';

// Assignment card detail / talent review. Reuses the subscription review view
// (it resolves a card by id regardless of product line); the `assignment`
// variant makes the URL, back-nav, and labels read "assignments".
export default function AssignmentCardReviewPage(props: { params: Promise<{ cardId: string }> }) {
  const params = use(props.params);
  return <SubscriptionCardReview cardId={params.cardId} variant="assignment" />;
}
