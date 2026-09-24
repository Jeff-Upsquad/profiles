'use client';

import { Suspense } from 'react';
import LoginTalent from '@/views/auth/LoginTalent';

// Suspense boundary: LoginTalent reads `?next=` (deep links bounce through
// here), and useSearchParams needs one to prerender.
export default function LoginTalentPage() {
  return (
    <Suspense>
      <LoginTalent />
    </Suspense>
  );
}
