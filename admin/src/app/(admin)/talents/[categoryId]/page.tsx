'use client';

import { use } from 'react';
import TalentProfileList from '@/views/talents/TalentProfileList';

export default function TalentCategoryPage(props: { params: Promise<{ categoryId: string }> }) {
  const params = use(props.params);
  return <TalentProfileList categoryId={params.categoryId} />;
}
