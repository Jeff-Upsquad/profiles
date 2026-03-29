'use client';

import { use } from 'react';
import ProfileView from '@/views/talent/ProfileView';

interface Params {
  id: string;
}

export default function ViewProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <ProfileView profileId={params.id} />;
}
