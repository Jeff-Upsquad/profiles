'use client';

import { use } from 'react';
import JobCardDetail from '@/components/jobs/talent/JobCardDetail';

export default function JobOpeningDetailPage(props: { params: Promise<{ recipientId: string }> }) {
  const params = use(props.params);
  return <JobCardDetail recipientId={params.recipientId} />;
}
