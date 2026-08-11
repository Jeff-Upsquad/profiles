'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bidding is no longer a separate module — it lives as a tab inside
 * Subscriptions and Assignments. Keep this route so old bookmarks / pushes
 * still land somewhere useful.
 */
export default function TalentBiddingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/talent/subscriptions?tab=bidding');
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" />
    </div>
  );
}
