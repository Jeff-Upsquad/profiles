'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout, { type SidebarItem } from '@/components/layout/DashboardLayout';
import Badge from '@/components/ui/Badge';
import { useUnreadSubscriptionCount } from '@/hooks/useSubscriptionCards';
import { useModuleAccess, useMyTraining } from '@/hooks/useTraining';

const ALWAYS_ACCESSIBLE = ['/talent/dashboard', '/talent/training', '/talent/contact-support'];

const ROUTE_TO_MODULE: Record<string, string> = {
  '/talent/basic-profile': 'basic-profile',
  '/talent/profiles': 'profiles',
  '/talent/subscriptions': 'subscriptions',
  '/talent/assignments': 'subscriptions',
  '/talent/my-clients': 'subscriptions',
  '/talent/settings': 'settings',
  '/talent/notifications': 'notifications',
};

export default function TalentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const isTalent = !!user && user.role === 'talent';
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;
  const { data: unread = 0 } = useUnreadSubscriptionCount({ enabled: isTalent });
  const { data: moduleAccess, isLoading: accessLoading } = useModuleAccess();
  const { data: trainingData } = useMyTraining();
  const incompleteCoursesCount = (trainingData?.courses ?? []).filter(
    (c) => c.total_count > 0 && c.completed_count < c.total_count,
  ).length;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F5F6]">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    router.push('/login/talent');
    return null;
  }

  if (user.role !== 'talent') {
    router.push('/dashboard');
    return null;
  }

  const unlockedSet = new Set(moduleAccess?.unlocked ?? []);
  const lockedMap = new Map(
    (moduleAccess?.locked ?? []).map((l) => [l.module, l]),
  );

  const isModuleLocked = (route: string): boolean => {
    if (ALWAYS_ACCESSIBLE.some((r) => route === r || route.startsWith(r + '/'))) return false;
    const mod = Object.entries(ROUTE_TO_MODULE).find(([r]) => route === r || route.startsWith(r + '/'))?.[1];
    if (!mod) return !onboarded;
    if (accessLoading) return !onboarded;
    if (unlockedSet.has(mod)) return false;
    if (lockedMap.has(mod)) return true;
    return !onboarded;
  };

  if (pathname && isModuleLocked(pathname)) {
    router.push('/talent/dashboard');
    return null;
  }

  const sidebarItems: SidebarItem[] = [
    {
      label: 'Dashboard',
      to: '/talent/dashboard',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Basic Profile',
      to: '/talent/basic-profile',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: 'Job Profiles',
      to: '/talent/profiles',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Subscriptions',
      to: '/talent/subscriptions',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
        </svg>
      ),
      badge: unread > 0 ? <Badge variant="indigo">{unread}</Badge> : undefined,
    },
    {
      label: 'Assignments',
      to: '/talent/assignments',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'My Clients',
      to: '/talent/my-clients',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 11l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Job Openings',
      to: '/talent/job-openings',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Settings',
      to: '/talent/settings',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Notifications',
      to: '/talent/notifications',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      label: 'Training Program',
      to: '/talent/training',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      badge: incompleteCoursesCount > 0 ? <Badge variant="indigo">{incompleteCoursesCount}</Badge> : undefined,
    },
    {
      label: 'Contact Support',
      to: '/talent/contact-support',
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
  ];

  const gatedItems = sidebarItems.map((item) => {
    const isAlwaysAccessible = ALWAYS_ACCESSIBLE.some(
      (r) => item.to === r || item.to.startsWith(r + '/'),
    );
    if (isAlwaysAccessible) return item;

    const mod = ROUTE_TO_MODULE[item.to];
    if (!mod) {
      if (accessLoading) {
        return onboarded ? item : { ...item, disabled: true, tooltip: 'Loading...' };
      }
      return onboarded ? item : { ...item, disabled: true, tooltip: 'Complete training to unlock' };
    }
    if (accessLoading) {
      return onboarded ? item : { ...item, disabled: true, tooltip: 'Loading...' };
    }
    if (unlockedSet.has(mod)) return item;
    const lock = lockedMap.get(mod);
    if (lock) {
      return {
        ...item,
        disabled: true,
        tooltip: `Complete "${lock.chapter_title}" to unlock (${lock.completed}/${lock.total})`,
      };
    }
    return onboarded ? item : { ...item, disabled: true, tooltip: 'Complete training to unlock' };
  });

  return <DashboardLayout sidebarItems={gatedItems}>{children}</DashboardLayout>;
}
