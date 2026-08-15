'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useIncompleteTrainingCount, useModuleAccess } from '@/hooks/useTraining';
import Badge from '@/components/ui/Badge';

interface MoreItem {
  label: string;
  to: string;
  description: string;
  module?: string;
  badge?: number;
  icon: React.ReactNode;
}

export default function TalentMore() {
  const { user } = useAuth();
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;
  const { data: moduleAccess, isLoading: accessLoading } = useModuleAccess();
  const { data: incompleteTraining = 0 } = useIncompleteTrainingCount();

  const unlockedSet = new Set(moduleAccess?.unlocked ?? []);
  const lockedMap = new Map((moduleAccess?.locked ?? []).map((l) => [l.module, l]));

  const isLocked = (mod?: string) => {
    if (!mod) return false;
    if (accessLoading) return !onboarded;
    if (unlockedSet.has(mod)) return false;
    if (lockedMap.has(mod)) return true;
    return !onboarded;
  };

  const groups: { title: string; items: MoreItem[] }[] = [
    {
      title: 'Profile',
      items: [
        {
          label: 'Basic Profile',
          to: '/talent/basic-profile',
          description: 'Your personal details and job preferences',
          module: 'basic-profile',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        },
        {
          label: 'Job Profiles',
          to: '/talent/profiles',
          description: 'Role-specific profiles businesses discover',
          module: 'profiles',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          label: 'My Clients',
          to: '/talent/my-clients',
          description: 'Businesses you are working with',
          module: 'subscriptions',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Settings',
          to: '/talent/settings',
          description: 'Login details and account preferences',
          module: 'settings',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          label: 'Training Program',
          to: '/talent/training',
          description: 'Courses, SOPs, and assigned lessons',
          badge: incompleteTraining,
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          label: 'Contact Support',
          to: '/talent/contact-support',
          description: 'Chat with the UpSquad team',
          icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
          More
        </h1>
        <p className="mt-1 text-sm text-[#737373]">
          Profile, training, and account
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#E7E7EA] px-5 py-3">
            <h2 className="font-[family-name:var(--font-jakarta)] text-xs font-semibold uppercase tracking-wide text-[#a3a3a3]">
              {group.title}
            </h2>
          </div>
          <ul className="divide-y divide-[#E7E7EA]">
            {group.items.map((item) => {
              const locked = isLocked(item.module);
              const lock = item.module ? lockedMap.get(item.module) : undefined;
              return (
                <li key={item.to}>
                  <Link
                    href={item.to}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#F5F5F6]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F6] text-[#525252]">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                          {item.label}
                        </span>
                        {item.badge != null && item.badge > 0 && (
                          <Badge variant="indigo">{item.badge}</Badge>
                        )}
                        {locked && (
                          <span className="inline-flex items-center text-[#a3a3a3]" title={lock ? `Complete "${lock.chapter_title}" to unlock` : 'Complete training to unlock'}>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#737373]">
                        {item.description}
                      </span>
                    </span>
                    <svg className="h-4 w-4 shrink-0 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
