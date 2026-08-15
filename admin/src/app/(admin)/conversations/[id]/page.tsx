'use client';

import { useParams } from 'next/navigation';
import ConversationDetail from '@/views/conversations/ConversationDetail';

export default function ConversationDetailPage() {
  const params = useParams();
  return <ConversationDetail id={params.id as string} />;
}
