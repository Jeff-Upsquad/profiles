'use client';

import { Suspense } from 'react';
import CreativeLeadForm from '@/views/forms/CreativeLeadForm';

export default function CreativeApplyPage() {
  return (
    <Suspense>
      <CreativeLeadForm />
    </Suspense>
  );
}
