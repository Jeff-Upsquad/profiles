'use client';

import { useState } from 'react';
import { useHowItWorksVideos } from '@/hooks/useHowItWorks';
import { LANGUAGE_LABELS } from '@/hooks/useTraining';
import { useHowItWorksLanguageGate } from '@/hooks/useHowItWorksLanguageGate';
import HowItWorksHeroMedia from './how-it-works/HowItWorksHeroMedia';
import HowItWorksLanguageGate from './how-it-works/HowItWorksLanguageGate';

// The How-it-works walkthrough (language-gated video + Squad Hire /
// Squad Hub explainer tabs), extracted so it can render in two places:
//
//   • `variant="page"`     — the standalone /business/how-it-works route, which
//                            is what businesses see before their first hire.
//   • `variant="embedded"` — a section inside My Cards, where this content
//                            moves once the SquadHub tab takes over the fourth
//                            nav slot, so the guide is never lost.
//
// Player format matches the upsquad-site landing hero: pressing play opens a
// "Choose your language" modal, picking a language starts playback with
// speed control. The language choice persists to localStorage, so picking it
// in one place carries to the other.

export default function HowItWorksContent({
  variant = 'page',
}: {
  variant?: 'page' | 'embedded';
}) {
  const { data: videos = [], isLoading } = useHowItWorksVideos();
  const [activeTab, setActiveTab] = useState<'hire' | 'hub'>('hire');

  const languages = videos.map((v) => ({
    code: v.language,
    name: LANGUAGE_LABELS[v.language] ?? v.language.toUpperCase(),
  }));

  const {
    selected,
    selectedCode,
    gateOpen,
    setGateOpen,
    pendingPlay,
    requestPlay,
    onSelectLanguage,
  } = useHowItWorksLanguageGate(languages);

  const currentVideo = videos.find((v) => v.language === (selected?.code ?? ''));
  const previewUrl = currentVideo?.loom_url ?? videos[0]?.loom_url;

  const languagePill = selected && languages.length > 1 && (
    <button
      type="button"
      onClick={() => setGateOpen(true)}
      aria-label="Change video language"
      className="inline-flex items-center gap-2 rounded-full border border-[#E7E7EA] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:border-gray-300 stagger-4"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9zM3.6 9h16.8M3.6 15h16.8" />
      </svg>
      Language: {selected.name}
    </button>
  );

  return (
    <div className="space-y-6">
      {variant === 'page' ? (
        <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
          <div className="hero-glow-blur" />
          <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2.5 stagger-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Guide
                </span>
              </div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
                How it <span className="text-[#0a0a0a]">works</span>
              </h1>
              <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] max-w-xl stagger-3">
                Watch the video to learn how UpSquad helps you find, onboard, and manage top talent.
              </p>
            </div>
            {languagePill}
          </div>
        </section>
      ) : (
        languagePill && <div className="flex justify-end">{languagePill}</div>
      )}

      {isLoading ? (
        <div className="aspect-video rounded-2xl bg-[#f0f0f0] animate-pulse" />
      ) : videos.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              Video coming soon
            </h3>
            <p className="mt-1 text-sm text-[#737373]">
              Check back shortly — our team is preparing a walkthrough for you.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-[#09090B] shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)]">
            <HowItWorksHeroMedia
              videoUrl={currentVideo?.loom_url}
              previewUrl={previewUrl}
              autoPlay={pendingPlay}
              onRequestGate={requestPlay}
            />
          </div>
          <HowItWorksLanguageGate
            open={gateOpen}
            languages={languages}
            selectedCode={selectedCode}
            onSelect={onSelectLanguage}
            onDismiss={() => setGateOpen(false)}
          />
        </>
      )}

      <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="flex border-b border-[#E7E7EA]">
          <button
            onClick={() => setActiveTab('hire')}
            className={`flex-1 px-6 py-3.5 text-sm font-semibold transition-colors relative ${
              activeTab === 'hire'
                ? 'text-[#0a0a0a]'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <span className="font-[family-name:var(--font-jakarta)]">Squad Hire</span>
            {activeTab === 'hire' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0a0a0a]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('hub')}
            className={`flex-1 px-6 py-3.5 text-sm font-semibold transition-colors relative ${
              activeTab === 'hub'
                ? 'text-[#0a0a0a]'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <span className="font-[family-name:var(--font-jakarta)]">Squad Hub</span>
            {activeTab === 'hub' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0a0a0a]" />
            )}
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {activeTab === 'hire' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2]">
                  <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                    Squad Hire
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#525252]">
                    This is the platform you are currently using. Squad Hire helps you discover, evaluate, and onboard new talent for your team.
                  </p>
                </div>
              </div>
              <div className="ml-14 space-y-3">
                <Feature icon="search" text="Browse curated talent profiles across categories" />
                <Feature icon="filter" text="Filter candidates by skills, experience, and availability" />
                <Feature icon="star" text="Shortlist your favourite profiles for quick access" />
                <Feature icon="check" text="Send interest requests and move to onboarding seamlessly" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F5F5F6]">
                  <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                    Squad Hub
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#525252]">
                    Once your talent is onboarded, Squad Hub is where everything gets managed — projects, tasks, communication, and performance.
                  </p>
                </div>
              </div>
              <div className="ml-14 space-y-3">
                <Feature icon="folder" text="Organise and manage your onboarded talent in one place" />
                <Feature icon="chat" text="Communicate directly with your team members" />
                <Feature icon="chart" text="Track tasks, deliverables, and overall performance" />
                <Feature icon="shield" text="Control access, roles, and permissions for your squad" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-[#F5F5F6]">
        <FeatureIcon name={icon} />
      </div>
      <p className="font-[family-name:var(--font-inter)] text-sm text-[#525252]">{text}</p>
    </div>
  );
}

function FeatureIcon({ name }: { name: string }) {
  const cls = "h-3.5 w-3.5 text-[#a3a3a3]";
  switch (name) {
    case 'search':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    case 'filter':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      );
    case 'star':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      );
    case 'check':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'folder':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    case 'chat':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'chart':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    default:
      return null;
  }
}
