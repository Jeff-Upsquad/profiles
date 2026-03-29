'use client';

import { use } from 'react';
import TalentProfileView from '@/views/talents/TalentProfileView';

export default function TalentProfilePage(props: {
  params: Promise<{ categoryId: string; profileId: string }>;
}) {
  const params = use(props.params);
  return <TalentProfileView categoryId={params.categoryId} profileId={params.profileId} />;
}
