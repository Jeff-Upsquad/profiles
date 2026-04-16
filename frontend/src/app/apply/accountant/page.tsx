'use client';

import { Suspense } from 'react';
import AccountantLeadForm from '@/views/forms/AccountantLeadForm';

export default function AccountantApplyPage() {
  return (
    <Suspense>
      <AccountantLeadForm />
    </Suspense>
  );
}
