'use client';

import { Suspense } from 'react';
import LeadList from '@/views/leads/LeadList';

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadList />
    </Suspense>
  );
}
