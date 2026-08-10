'use client';

import { useParams } from 'next/navigation';
import SopEditor from '@/views/training/SopEditor';

export default function SopEditorPage() {
  const { sopId } = useParams<{ sopId: string }>();
  return <SopEditor sopId={sopId} />;
}
