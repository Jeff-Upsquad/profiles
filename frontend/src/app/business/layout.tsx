'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BusinessSidebar from '@/components/layout/BusinessSidebar';

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (user.role !== 'business') {
    router.push('/dashboard');
    return null;
  }

  return (
    <DashboardLayout sidebarContent={({ onNavigate }) => <BusinessSidebar onNavigate={onNavigate} />}>
      {children}
    </DashboardLayout>
  );
}
