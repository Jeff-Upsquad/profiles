'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'business') {
        router.push('/business/dashboard');
      } else if (user.role === 'talent') {
        router.push('/talent/dashboard');
      } else if (user.role === 'admin') {
        router.push('/admin/');
      } else {
        router.push('/');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
    </div>
  );
}
