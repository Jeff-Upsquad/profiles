'use client';

import { use } from 'react';
import TalentProfileEditView from '@/views/talents/TalentProfileEditView';

export default function TalentProfileEditPage(props: {
  params: Promise<{ categoryId: string; profileId: string }>;
}) {
  const params = use(props.params);
  return <TalentProfileEditView categoryId={params.categoryId} profileId={params.profileId} />;
}
