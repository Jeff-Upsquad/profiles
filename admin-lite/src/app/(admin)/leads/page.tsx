import { Suspense } from 'react';
import LeadList from '@/views/leads/LeadList';

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
      <LeadList />
    </Suspense>
  );
}
