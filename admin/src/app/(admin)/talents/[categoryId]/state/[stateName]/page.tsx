'use client';

import { use } from 'react';
import TalentProfileList from '@/views/talents/TalentProfileList';

export default function StateDashboardPage(props: {
  params: Promise<{ categoryId: string; stateName: string }>;
}) {
  const params = use(props.params);
  return <TalentProfileList categoryId={params.categoryId} stateName={params.stateName} />;
}
