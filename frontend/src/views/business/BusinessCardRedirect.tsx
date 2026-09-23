'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

/**
 * Resolves a card id to its review screen and forwards there.
 *
 * Reached from the "View card" button on a WhatsApp card alert. The business
 * layout has already handled auth by the time this renders (a logged-out tap
 * bounces through `/login/business?next=/business/card/<id>` and comes back
 * here), so all that's left is asking the API which product line the card
 * belongs to.
 */
export default function BusinessCardRedirect({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/business/card-link/${cardId}`);
        if (cancelled) return;
        if (typeof data?.path === 'string' && data.path.startsWith('/')) {
          router.replace(data.path);
          return;
        }
        setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId, router]);

  if (failed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-base font-medium text-[#0a0a0a]">
          We couldn&apos;t open that card.
        </p>
        <p className="text-sm text-gray-500">
          It may have been closed or filled since you got the message.
        </p>
        <Link
          href="/business/hire"
          className="rounded-full bg-[#0a0a0a] px-5 py-2 text-sm font-medium text-white"
        >
          Go to my cards
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
    </div>
  );
}
