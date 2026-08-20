'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHasAssignedCard } from '@/components/business/cards/hireActivity';

// Where SquadHub lives. The APK link points at SquadHub's own download page
// rather than a raw .apk URL on purpose: that page reads the release manifest
// (GET /business-app/version) and knows whether a build has actually been
// published, so version handling stays in one place.
const SQUADHUB_APK_URL = 'https://squadhub.in/business-app';

// Not squadhub.in directly: this local page mints a one-time sign-in code with
// the business's session and forwards them, so the web option lands them
// already signed in. See frontend/src/app/business/squadhub/launch/page.tsx.
const SQUADHUB_WEB_URL = '/business/squadhub/launch';

/**
 * The SquadHub gateway — what the fourth bottom-nav tab opens once the
 * business has its first assigned card. Three ways in: the Android app, iOS
 * (not yet), and the web app.
 *
 * The web option signs them in automatically — their SquadHub account is
 * created for them when their first card is assigned, so there is nothing to
 * register. The Android app still takes the same email and password they use
 * here.
 */
export default function SquadHubGateway() {
  const router = useRouter();
  const { hasAssignedCard, isLoading } = useHasAssignedCard();

  // Guard the route itself, not just the nav entry — this page is meaningless
  // (and the SquadHub account doesn't exist yet) before the first assignment.
  useEffect(() => {
    if (!isLoading && !hasAssignedCard) {
      router.replace('/business/how-it-works');
    }
  }, [isLoading, hasAssignedCard, router]);

  if (isLoading || !hasAssignedCard) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-7 sm:px-7 sm:py-8">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#0A0A0A] shadow-[0_16px_38px_-16px_rgba(0,0,0,0.45)] stagger-1">
            <span className="font-[family-name:var(--font-jakarta)] text-[22px] font-extrabold tracking-tight text-white">
              SH
            </span>
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#FFFF99]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#0a0a0a] sm:text-[30px] stagger-2">
              SquadHub
            </h1>
            <p className="mt-1.5 max-w-xl font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Your talent is onboarded — SquadHub is where the work happens. Track projects and
              tasks, chat with your team, and follow deliverables day to day.
            </p>
          </div>
        </div>
      </section>

      {/* Sign-in note */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#E7E7EA] bg-[#FFFAC2]/40 px-5 py-4">
        <svg
          className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-[#0a0a0a]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <p className="font-[family-name:var(--font-inter)] text-[13px] leading-relaxed text-[#525252]">
          Your SquadHub account is <span className="font-semibold text-[#0a0a0a]">already set up</span>.
          Opening it on the web signs you straight in — no password needed. In the app, use the same
          email and password you use here.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <OptionCard
          href={SQUADHUB_APK_URL}
          title="Download the Android app"
          body="Install the SquadHub Business app on your Android phone."
          actionLabel="Download APK"
          icon={
            <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 19h16" />
            </svg>
          }
        />

        <OptionCard
          href={SQUADHUB_WEB_URL}
          title="Open on the web"
          body="Opens SquadHub in your browser, already signed in."
          actionLabel="Open SquadHub"
          icon={
            <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            </svg>
          }
        />

        {/* iOS — deliberately inert until there's a build to point at. */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#E7E7EA] bg-[#FAFAFA] px-5 py-4 opacity-70">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F0F0F0]">
            <svg className="h-5 w-5 text-[#a3a3a3]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.015em] text-[#737373]">
                iOS app
              </h3>
              <span className="rounded-full bg-[#E7E7EA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#737373]">
                Coming soon
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-[#a3a3a3]">
              An iPhone app is on the way. Use the website in the meantime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  href,
  title,
  body,
  actionLabel,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  actionLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 rounded-2xl border border-[#E7E7EA] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-[#0a0a0a]/20 hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.12)]"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
          {title}
        </h3>
        <p className="mt-0.5 text-[13px] text-[#737373]">{body}</p>
      </div>
      <span className="hidden flex-shrink-0 items-center gap-1.5 rounded-full bg-[#0a0a0a] px-4 py-2 text-[13px] font-semibold text-white transition-opacity group-hover:opacity-85 sm:inline-flex">
        {actionLabel}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </span>
      <svg
        className="h-4 w-4 flex-shrink-0 text-[#a3a3a3] sm:hidden"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}
