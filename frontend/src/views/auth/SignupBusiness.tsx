'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupBusiness() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Business signup is invite-only. Redirecting to login...</p>
    </div>
  );
}
