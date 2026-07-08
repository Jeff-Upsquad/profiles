'use client';

import { use } from 'react';
import OfferLetterView from '@/components/jobs/talent/OfferLetterView';

export default function TalentJobOfferPage(props: { params: Promise<{ offerId: string }> }) {
  const params = use(props.params);
  return <OfferLetterView offerId={params.offerId} />;
}
