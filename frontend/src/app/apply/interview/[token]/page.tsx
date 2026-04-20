'use client';

import { use } from 'react';
import InterviewForm from '@/views/forms/InterviewForm';

export default function InterviewApplyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <InterviewForm token={token} />;
}
