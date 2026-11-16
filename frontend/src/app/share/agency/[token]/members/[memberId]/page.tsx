'use client';

import { use } from 'react';
import AgencyMemberPublicShareView from '@/views/share/AgencyMemberPublicShareView';

export default function AgencyMemberSharePage({
  params,
}: {
  params: Promise<{ token: string; memberId: string }>;
}) {
  const { token, memberId } = use(params);
  return <AgencyMemberPublicShareView token={token} memberId={memberId} />;
}
