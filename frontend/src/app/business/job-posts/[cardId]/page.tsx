'use client';

import { use } from 'react';
import BusinessJobConsole from '@/components/jobs/business/BusinessJobConsole';

export default function BusinessJobConsolePage(props: { params: Promise<{ cardId: string }> }) {
  const params = use(props.params);
  return <BusinessJobConsole cardId={params.cardId} />;
}
