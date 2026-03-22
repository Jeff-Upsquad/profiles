'use client';

import { use } from 'react';
import ProfileReview from '@/pages/profiles/ProfileReview';

interface Params {
  id: string;
}

export default function ProfileReviewPage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <ProfileReview profileId={params.id} />;
}
