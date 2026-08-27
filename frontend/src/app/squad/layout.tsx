'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import DashboardLayout, { type SidebarItem } from '@/components/layout/DashboardLayout';

export default function SquadLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(()=>{
    if(!isLoading){
      if(!user) router.replace('/login/squad');
      else if(user.role!=='squad_member' && user.role!=='squad_manager') router.replace('/dashboard');
    }
  },[user,isLoading,router]);
  if(isLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F6]"><div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" /></div>;
  if(!user || (user.role!=='squad_member' && user.role!=='squad_manager')) return null;

  const sidebarItems: SidebarItem[] = [
    { label: 'Dashboard', to: '/squad/dashboard', icon: (<svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a2 2 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>) },
    { label: 'Basic Profile', to: '/squad/profile', groupStart: true, icon: (<svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>) },
    { label: 'Job Profiles', to: '/squad/profiles', icon: (<svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>) },
  ];

  return (
    <DashboardLayout sidebarItems={sidebarItems} hideMobileSidebar hideNavbarOnMobile>
      <div className="md:hidden sticky top-0 z-10 -mx-4 mb-4 border-b border-[#E7E7EA] bg-white px-4 py-3 flex items-center justify-between">
        <div className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">Squad Workspace {user.role==='squad_manager' && <span className="ml-2 rounded-full bg-[#FFFAC2] border border-[#0a0a0a] px-2 py-0.5 text-[10px]">Manager</span>}</div>
        <div className="text-xs text-[#737373] truncate">{user.email}</div>
      </div>
      {children}
      <div className="h-[64px] md:hidden" />
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white md:hidden">
        <nav className="mx-auto flex max-w-lg items-center justify-around py-2">
          <a href="/squad/dashboard" className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-[#0a0a0a]">Home</a>
          <a href="/squad/profile" className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-zinc-500">Profile</a>
          <a href="/squad/profiles" className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-zinc-500">Jobs</a>
        </nav>
      </div>
    </DashboardLayout>
  );
}
