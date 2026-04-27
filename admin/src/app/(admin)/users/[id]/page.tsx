'use client';

import { use } from 'react';
import UserDetail from '@/views/users/UserDetail';

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <UserDetail userId={id} />;
}
