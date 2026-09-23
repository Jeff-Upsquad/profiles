'use client';

import { Suspense } from 'react';
import LoginBusiness from '@/views/auth/LoginBusiness';

// Suspense boundary: LoginBusiness reads `?next=` (deep links bounce through
// here), and useSearchParams needs one to prerender.
export default function LoginBusinessPage() {
  return (
    <Suspense>
      <LoginBusiness />
    </Suspense>
  );
}
