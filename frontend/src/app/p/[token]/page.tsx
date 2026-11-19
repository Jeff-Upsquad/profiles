'use client';

import { use } from 'react';
import ProfilePublicShareView from '@/views/share/ProfilePublicShareView';

export default function ShortProfileSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <ProfilePublicShareView token={token} />;
}
