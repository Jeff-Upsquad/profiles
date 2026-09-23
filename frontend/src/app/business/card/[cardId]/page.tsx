'use client';

import { use } from 'react';
import BusinessCardRedirect from '@/views/business/BusinessCardRedirect';

// Type-agnostic card landing page. The WhatsApp card-alert template's URL
// button can only vary the tail of one fixed URL, so every alert — subscription,
// assignment or job post — points here and this page forwards to the right
// review screen.
export default function BusinessCardRedirectPage(props: {
  params: Promise<{ cardId: string }>;
}) {
  const params = use(props.params);
  return <BusinessCardRedirect cardId={params.cardId} />;
}
