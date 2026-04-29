'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ProfileEdit from '@/views/talent/ProfileEdit';
import { useProfile } from '@/hooks/useProfiles';

interface Params {
  id: string;
}

export default function EditProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();
  const { data: profile } = useProfile(params.id);

  // Ghost "Designer + Editor" profiles are auto-generated from the
  // talent's Designer and Video Editor source profiles and have no
  // editable field_data. Bounce manual /edit URLs back to the view.
  useEffect(() => {
    if (profile?.is_ghost) {
      router.replace(`/talent/profiles/${params.id}`);
    }
  }, [profile?.is_ghost, params.id, router]);

  if (profile?.is_ghost) return null;
  return <ProfileEdit profileId={params.id} />;
}
