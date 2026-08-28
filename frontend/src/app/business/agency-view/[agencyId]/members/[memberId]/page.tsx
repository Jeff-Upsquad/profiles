'use client';

import { use } from 'react';
import AgencyMemberPublicView from '@/views/business/AgencyMemberPublicView';

export default function AgencyMemberViewPage({ params }: { params: Promise<{ agencyId: string; memberId: string }> }) {
  const { agencyId, memberId } = use(params);
  return <AgencyMemberPublicView agencyId={agencyId} memberId={memberId} />;
}
