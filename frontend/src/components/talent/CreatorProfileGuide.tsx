'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMyProfiles } from '@/hooks/useProfiles';
import { isSocialMediaCreator } from '@/lib/creatorIdentity';

type GuideStep = 'navigation' | 'profiles' | 'create' | 'category';
const changeEvent = 'creator-profile-guide-dismissed';
// Browser storage can be blocked; dismissal still works for the current session.
const dismissedInSession = new Set<string>();
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

/** Visible coach marks also work on touch screens without hovering. */
export default function CreatorProfileGuide({ step, mobile = false }: { step: GuideStep; mobile?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const creator = user?.role === 'talent' && isSocialMediaCreator(user);
  const { data: profiles, isSuccess } = useMyProfiles({ enabled: creator });
  const key = `creator-profile-guide:v1:${user?.id ?? ''}`;
  const dismissed = useSyncExternalStore(subscribe, () => {
    if (dismissedInSession.has(key)) return true;
    try { return localStorage.getItem(key) === 'dismissed'; } catch { return false; }
  }, () => false);
  const expectedPath = {
    navigation: '/talent/dashboard', profiles: '/talent/more',
    create: '/talent/profiles', category: '/talent/profiles/new',
  }[step];
  if (!creator || !isSuccess || dismissed || pathname !== expectedPath
    || user?.application_cancelled_at || (user?.stage_inactivity?.length ?? 0) > 0
    || profiles?.some((profile) => !profile.is_ghost && profile.category?.slug === 'social-media-creator')) return null;

  const tip = {
    navigation: {
      number: 1,
      text: mobile
        ? 'Tap More below, then Job Profiles to start your Social Media Creator job profile.'
        : 'Open Job Profiles in the sidebar to start your Social Media Creator job profile.',
      href: mobile ? '/talent/more' : '/talent/profiles',
      action: mobile ? 'Open More' : 'Open Job Profiles',
    },
    profiles: {
      number: 2,
      text: 'Open Job Profiles above. This is where you create and manage your Social Media Creator job profile.',
      href: '/talent/profiles', action: 'Open Job Profiles',
    },
    create: {
      number: 3,
      text: 'Tap Create Profile above, then choose Social Media Creator under Content Creation.',
      href: '/talent/profiles/new', action: 'Create Profile',
    },
    category: {
      number: 4,
      text: 'Choose Social Media Creator under Content Creation below. Add your channels, audience and content details, then submit your job profile for review.',
      href: '', action: '',
    },
  }[step];
  return (
    <aside aria-label="Creator job profile guide" className="relative mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-950 shadow-sm">
      {mobile && <span aria-hidden="true" className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-amber-200 bg-amber-50" />}
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Create your creator job profile · {tip.number}/4</p>
        <button type="button" aria-label="Dismiss creator job profile guide" className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => {
          dismissedInSession.add(key);
          try { localStorage.setItem(key, 'dismissed'); } catch { /* Session fallback above. */ }
          window.dispatchEvent(new Event(changeEvent));
        }}>×</button>
      </div>
      <p className="mt-1 leading-relaxed">{tip.text}</p>
      {tip.href && <Link href={tip.href} className="mt-2 inline-flex min-h-9 items-center font-semibold underline underline-offset-4">{tip.action} →</Link>}
    </aside>
  );
}
