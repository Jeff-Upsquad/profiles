'use client';

import { Suspense } from 'react';
import PublishedCardsList from '@/views/published-cards/PublishedCardsList';

export default function PublishedCardsPage() {
  return (
    <Suspense>
      <PublishedCardsList />
    </Suspense>
  );
}
