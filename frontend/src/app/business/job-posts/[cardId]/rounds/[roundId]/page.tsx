'use client';

import { use } from 'react';
import InterviewDayConsole from '@/components/jobs/business/InterviewDayConsole';

export default function InterviewDayConsolePage(props: {
  params: Promise<{ cardId: string; roundId: string }>;
}) {
  const params = use(props.params);
  return <InterviewDayConsole cardId={params.cardId} roundId={params.roundId} />;
}
