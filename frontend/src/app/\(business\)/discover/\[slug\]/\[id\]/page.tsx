'use client';

import { use } from 'react';
import ViewProfile from '@/pages/business/ViewProfile';

interface Params {
  slug: string;
  id: string;
}

export default function ViewProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <ViewProfile profileId={params.id} categorySlug={params.slug} />;
}
