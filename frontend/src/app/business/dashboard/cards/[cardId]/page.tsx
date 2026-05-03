'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CardRedirectPage(props: { params: Promise<{ cardId: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/business/subscription/${params.cardId}`);
  }, [router, params.cardId]);

  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0a0a0a] border-t-transparent" />
    </div>
  );
}
