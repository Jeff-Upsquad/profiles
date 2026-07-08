'use client';

import { use } from 'react';
import JobProfileView from '@/components/jobs/talent/JobProfileView';

export default function TalentJobProfilePage(props: { params: Promise<{ jobProfileId: string }> }) {
  const params = use(props.params);
  return <JobProfileView jobProfileId={params.jobProfileId} />;
}
