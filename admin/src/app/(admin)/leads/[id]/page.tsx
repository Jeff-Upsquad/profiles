'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => {
    const id = params.id as string;
    if (id) router.replace(`/leads?selected=${encodeURIComponent(id)}`);
  }, [params.id, router]);
  return null;
}
