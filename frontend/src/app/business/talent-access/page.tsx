'use client';

import { Suspense } from 'react';
import BusinessTalentAccess from '@/views/business/BusinessTalentAccess';

export default function BusinessTalentAccessPage() {
  return (
    <Suspense>
      <BusinessTalentAccess />
    </Suspense>
  );
}
