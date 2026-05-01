'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMyTraining,
  useOnboardingTraining,
  useCompleteOnboarding,
  useMarkLessonComplete,
  useMarkLessonIncomplete,
  type TrainingChapter,
  type TrainingLesson,
} from '@/hooks/useTraining';

function loomEmbedUrl(shareUrl: string): string {
  return shareUrl.replace('/share/', '/embed/');
}

function ProgressBar({ completed, total, color = 'rainbow' }: { completed: number; total: number; color?: 'rainbow' | 'purple' }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            color === 'rainbow'
              ? 'bg-gradient-to-r from-[#FF8B47] via-[#D24DFF] to-[#5BB7FF]'
              : 'bg-[#6647F0]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-[family-name:var(--font-inter)] text-xs font-medium text-[#646464] whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

function LessonCard({ lesson, index }: { lesson: TrainingLesson; index: number }) {
  const markComplete = useMarkLessonComplete();
  const markIncomplete = useMarkLessonIncomplete();
  const isPending = markComplete.isPending || markIncomplete.isPending;

  const toggle = () => {
    if (lesson.completed) markIncomplete.mutate(lesson.id);
    else markComplete.mutate(lesson.id);
  };

  return (
    <div className="group rounded-2xl border border-[#ECECEF] overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
      <div className="aspect-video bg-[#09090B] relative">
        <iframe
          src={loomEmbedUrl(lesson.loom_url)}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen"
        />
        <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
          <span className="font-[family-name:var(--font-inter)] text-[11px] font-semibold text-white">
            Lesson {index + 1}
          </span>
        </div>
        {lesson.completed && (
          <div className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-[family-name:var(--font-jakarta)] font-semibold text-[#202020] tracking-[-0.01em]">{lesson.title}</h4>
            {lesson.description && (
              <p className="text-sm text-[#838383] mt-1 line-clamp-2">{lesson.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={isPending}
          className={`mt-3 font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.97] ${
            lesson.completed
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
              : 'bg-[#202020] text-white hover:bg-[#202020]/85'
          } disabled:opacity-50`}
        >
          {lesson.completed ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              Mark complete
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function ChapterAccordion({ chapter, defaultOpen = true }: { chapter: TrainingChapter; defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const isComplete = chapter.completed_count === chapter.total_count && chapter.total_count > 0;

  return (
    <div className="rounded-2xl border border-[#ECECEF] bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 sm:px-6 py-5 flex items-center gap-4 text-left transition-colors hover:bg-[#F8F9FA]"
      >
        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
          isComplete ? 'bg-emerald-50 text-emerald-600' : 'tint-purple'
        }`}
          style={!isComplete ? { color: 'var(--tint-icon)' } : undefined}
        >
          {isComplete ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#202020] truncate">{chapter.title}</h3>
          {chapter.description && (
            <p className="text-sm text-[#838383] mt-0.5 truncate">{chapter.description}</p>
          )}
          <div className="mt-2.5 max-w-md">
            <ProgressBar completed={chapter.completed_count} total={chapter.total_count} color={isComplete ? 'purple' : 'rainbow'} />
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[#A1A1AA] flex-shrink-0 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && chapter.lessons.length > 0 && (
        <div className="px-5 sm:px-6 pb-6 grid gap-4 sm:grid-cols-2">
          {chapter.lessons.map((lesson, idx) => (
            <LessonCard key={lesson.id} lesson={lesson} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function OnboardingTraining() {
  const router = useRouter();
  const { data: chapter, isLoading } = useOnboardingTraining();
  const completeOnboarding = useCompleteOnboarding();

  const allComplete = chapter ? chapter.completed_count === chapter.total_count && chapter.total_count > 0 : false;

  const handleBuildProfile = async () => {
    try {
      await completeOnboarding.mutateAsync();
      router.push('/talent/basic-profile');
    } catch {
      // handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Hero */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content">
          <div className="mb-2.5 stagger-1">
            <span className="eyebrow-rainbow">Onboarding</span>
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#202020] stagger-2">
            Complete the <span className="text-rainbow">Training</span> to Unlock Your Account
          </h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#646464] max-w-xl stagger-3">
            Watch the video below and mark it as complete to unlock all modules and start building your profile.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="h-32 bg-[#f0f0f0] rounded-2xl animate-pulse" />
      ) : !chapter ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2EEFF]">
              <svg className="h-6 w-6 text-[#6647F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#202020]">
              No onboarding content yet
            </h3>
            <p className="mt-1 text-sm text-[#838383]">Check back soon — your admin is setting things up.</p>
          </div>
        </div>
      ) : (
        <>
          <ChapterAccordion chapter={chapter} defaultOpen />

          {/* Build Profile CTA */}
          <div className="rounded-2xl border border-[#ECECEF] bg-white p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            {allComplete ? (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#202020]">
                  Training Complete!
                </h3>
                <p className="mt-1 text-sm text-[#838383] max-w-sm mx-auto">
                  You&apos;re all set. Click below to unlock your full account and start building your profile.
                </p>
                <button
                  onClick={handleBuildProfile}
                  disabled={completeOnboarding.isPending}
                  className="btn-iridescent mt-5 inline-flex text-sm py-2.5 px-6 disabled:opacity-50"
                >
                  {completeOnboarding.isPending ? 'Unlocking…' : 'Build Profile'}
                  <svg className="arrow-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
                  <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#202020]">
                  Complete all lessons to unlock
                </h3>
                <p className="mt-1 text-sm text-[#838383]">
                  {chapter.completed_count} of {chapter.total_count} lessons complete
                </p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TrainingProgram() {
  const { user } = useAuth();
  const onboarded = user?.onboarding_completed !== false;

  if (!onboarded) return <OnboardingTraining />;

  return <FullTrainingProgram />;
}

function FullTrainingProgram() {
  const { data: chapters, isLoading } = useMyTraining();

  // Compute overall progress
  const totals = (chapters ?? []).reduce(
    (acc, c) => ({ completed: acc.completed + c.completed_count, total: acc.total + c.total_count }),
    { completed: 0, total: 0 }
  );
  const overallPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Compact Hero with overall ring */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {totals.completed} of {totals.total} lessons complete
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#202020] stagger-2">
              <span className="text-rainbow">Training</span> Program.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#646464] stagger-3">
              Short videos to help you build a stronger profile and win more work.
            </p>
          </div>
          {totals.total > 0 && (
            <div className="stagger-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#ECECEF" strokeWidth="9" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="url(#train-grad)"
                    strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${(overallPct / 100) * 264} 264`}
                    className="transition-all duration-700"
                  />
                  <defs>
                    <linearGradient id="train-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FF8B47" />
                      <stop offset="50%" stopColor="#D24DFF" />
                      <stop offset="100%" stopColor="#5BB7FF" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.02em] text-[#202020]">
                  {overallPct}%
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-[#f0f0f0] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : !chapters?.length ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2EEFF]">
              <svg className="h-6 w-6 text-[#6647F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#202020]">
              No training content yet
            </h3>
            <p className="mt-1 text-sm text-[#838383]">Check back soon for new chapters and lessons.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, i) => (
            <div key={chapter.id} className={`stagger-${Math.min(i + 1, 6)}`}>
              <ChapterAccordion chapter={chapter} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
