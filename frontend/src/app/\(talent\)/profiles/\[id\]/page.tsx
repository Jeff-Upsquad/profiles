'use client';

import { use } from 'react';
import ProfileEdit from '@/pages/talent/ProfileEdit';

interface Params {
  id: string;
}

export default function EditProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <ProfileEdit profileId={params.id} />;
}
