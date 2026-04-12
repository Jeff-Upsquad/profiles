'use client';

import { use } from 'react';
import ProfilePreview from '@/views/talent/ProfilePreview';

interface Params {
  id: string;
}

export default function PreviewProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <ProfilePreview profileId={params.id} />;
}
