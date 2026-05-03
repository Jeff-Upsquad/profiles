'use client';

import { use } from 'react';
import SubscriptionCardReview from '@/views/business/SubscriptionCardReview';

export default function SubscriptionCardReviewPage(props: { params: Promise<{ cardId: string }> }) {
  const params = use(props.params);
  return <SubscriptionCardReview cardId={params.cardId} />;
}
