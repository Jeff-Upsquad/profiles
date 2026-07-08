'use client';

import { use } from 'react';
import InterviewInviteView from '@/components/jobs/talent/InterviewInviteView';

export default function TalentInterviewInvitePage(props: { params: Promise<{ inviteId: string }> }) {
  const params = use(props.params);
  return <InterviewInviteView inviteId={params.inviteId} />;
}
