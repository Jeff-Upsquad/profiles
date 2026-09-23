'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BusinessSidebar from '@/components/layout/BusinessSidebar';
import BusinessBottomNav from '@/components/layout/BusinessBottomNav';
import BusinessTopBar from '@/components/layout/BusinessTopBar';

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
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    // Carry the page they were after through the login hop — WhatsApp card
    // alerts link straight to a card, and most recipients won't have a live
    // session when they tap it. Read the URL off `window` rather than
    // useSearchParams so this layout doesn't need a Suspense boundary around
    // every business page.
    const intended =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : '';
    router.push(
      intended && intended !== '/business/hire'
        ? `/login/business?next=${encodeURIComponent(intended)}`
        : '/login/business',
    );
    return null;
  }

  if (user.role !== 'business') {
    router.push('/dashboard');
    return null;
  }

  return (
    <DashboardLayout
      hideMobileSidebar
      hideNavbar
      sidebarContent={({ onNavigate }) => <BusinessSidebar onNavigate={onNavigate} />}
    >
      <BusinessTopBar />
      {children}
      <BusinessBottomNav />
    </DashboardLayout>
  );
}
