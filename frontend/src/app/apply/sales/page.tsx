'use client';

import { Suspense } from 'react';
import SalesLeadForm from '@/views/forms/SalesLeadForm';

export default function SalesApplyPage() {
  return (
    <Suspense>
      <SalesLeadForm />
    </Suspense>
  );
}
