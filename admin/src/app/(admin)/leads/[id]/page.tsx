'use client';

import { useParams } from 'next/navigation';
import LeadDetail from '@/views/leads/LeadDetail';

export default function LeadDetailPage() {
  const params = useParams();
  return <LeadDetail id={params.id as string} />;
}
