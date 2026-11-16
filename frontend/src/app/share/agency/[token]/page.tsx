'use client';

import { use } from 'react';
import AgencyPublicShareView from '@/views/share/AgencyPublicShareView';

export default function AgencySharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <AgencyPublicShareView token={token} />;
}
