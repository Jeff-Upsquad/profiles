'use client';

import { use } from 'react';
import DiscoverProfiles from '@/pages/business/DiscoverProfiles';

interface Params {
  slug: string;
}

export default function DiscoverProfilesPage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <DiscoverProfiles categorySlug={params.slug} />;
}
