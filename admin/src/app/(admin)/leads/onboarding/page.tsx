'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// The Candidates → Onboarding tab merged into the Onboarding hub (/approvals).
// Keep the old URL working for bookmarks: forward, carrying the category.
export default function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const ft = params.get('form_type');
    const search = params.get('search');
    const q = new URLSearchParams();
    if (ft) q.set('category', ft);
    if (search) q.set('search', search);
    router.replace(`/approvals${q.toString() ? `?${q}` : ''}`);
  }, [router, params]);
  return <div className="p-8 text-sm text-gray-500">Opening Onboarding…</div>;
}
