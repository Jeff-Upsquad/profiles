'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMyTraining,
  useOnboardingCourses,
  useCompleteOnboarding,
  useMarkLessonComplete,
  useMarkLessonIncomplete,
  useRequestCourseReopen,
  pickLessonUrl,
  getCourseLanguages,
  getStoredCourseLanguage,
  setStoredCourseLanguage,
  formatRemaining,
  getActiveCountdowns,
  useNow,
  LANGUAGE_LABELS,
  type TrainingChapter,
  type TrainingLesson,
  type TrainingCourse,
  type TrainingSopSummary,
} from '@/hooks/useTraining';
import CourseStartPopup from './CourseStartPopup';
import SopReader from '@/components/training/SopReader';

// Both supported providers (Loom and SquadClips / clips.squadhub.in) expose a
// chrome-free player at the same token under `/embed/` instead of `/share/`.
function videoEmbedUrl(shareUrl: string): string {
  return shareUrl.replace('/share/', '/embed/');
}

/** Per-course language hook keyed by course id */
function useCourseLanguage(courseId: string, available: string[]) {
  const [language, setLanguageState] = useState<string>(available[0] ?? 'en');
  const [hasSelected, setHasSelected] = useState<boolean>(false);

  useEffect(() => {
    const stored = getStoredCourseLanguage(courseId);
    if (stored && available.includes(stored)) {
      setLanguageState(stored);
      setHasSelected(true);
    } else if (available.length > 0 && !available.includes(language)) {
      setLanguageState(available[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, available.join(',')]);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    setHasSelected(true);
    setStoredCourseLanguage(courseId, lang);
  };

  return [language, setLanguage, hasSelected] as const;
}

function LanguagePicker({
  language,
  available,
  onChange,
  highlight = false,
}: {
  language: string;
  available: string[];
  onChange: (lang: string) => void;
  highlight?: boolean;
}) {
  if (available.length <= 1) return null;
  return (
    <div className={`relative flex items-center gap-2 ${highlight ? 'lang-picker-highlight' : ''}`}>
      <svg className="h-4 w-4 text-[#525252]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
      <select
        value={language}
        onChange={(e) => onChange(e.target.value)}
        className={`font-[family-name:var(--font-inter)] rounded-lg border bg-white px-3 py-1.5 text-[13px] font-medium text-[#0a0a0a] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/30 focus:border-[#0a0a0a] ${
          highlight
            ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/30 animate-pulse'
            : 'border-[#E7E7EA]'
        }`}
      >
        {available.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABELS[lang] ?? lang.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}

function LanguageSelectionPrompt() {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[#0a0a0a]/40 bg-gradient-to-br from-[#FFFAC2]/60 to-white px-6 py-10 sm:py-8 text-center sm:text-left">
      <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
      <div className="relative sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center text-[#0a0a0a] sm:hidden">
          <svg className="h-10 w-10 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
            Pick your language to start
          </h3>
          <p className="mt-1.5 text-sm text-[#525252] max-w-sm mx-auto sm:mx-0">
            Choose a language from the dropdown above to begin watching the training videos.
          </p>
        </div>
        <div className="hidden sm:flex h-14 w-14 flex-shrink-0 items-end justify-end text-[#0a0a0a]">
          <svg className="h-12 w-12 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7m0 0H8m9 0v9" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ completed, total, color = 'rainbow' }: { completed: number; total: number; color?: 'rainbow' | 'purple' }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            color === 'rainbow'
              ? 'bg-gradient-to-r from-[#FFF27A] via-[#0A0A0A] to-[#737373]'
              : 'bg-[#0a0a0a]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-[family-name:var(--font-inter)] text-xs font-medium text-[#525252] whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

const WATCH_COOLDOWN_SECONDS = 60;

export function LessonCard({ lesson, index, language }: { lesson: TrainingLesson; index: number; language: string }) {
  const markComplete = useMarkLessonComplete();
  const markIncomplete = useMarkLessonIncomplete();
  const isPending = markComplete.isPending || markIncomplete.isPending;
  const videoUrl = pickLessonUrl(lesson, language);

  const [secondsLeft, setSecondsLeft] = useState(lesson.completed ? 0 : WATCH_COOLDOWN_SECONDS);

  useEffect(() => {
    setSecondsLeft(lesson.completed ? 0 : WATCH_COOLDOWN_SECONDS);
  }, [videoUrl, lesson.completed]);

  useEffect(() => {
    if (lesson.completed) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lesson.completed, videoUrl]);

  const cooldownActive = !lesson.completed && secondsLeft > 0;
  const toggle = () => {
    if (cooldownActive) return;
    if (lesson.completed) markIncomplete.mutate(lesson.id);
    else markComplete.mutate(lesson.id);
  };

  return (
    <div className="group rounded-2xl border border-[#E7E7EA] overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
      <div className="aspect-video bg-[#09090B] relative">
        <iframe
          src={videoEmbedUrl(videoUrl)}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
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
            <h4 className="font-[family-name:var(--font-jakarta)] font-semibold text-[#0a0a0a] tracking-[-0.01em]">{lesson.title}</h4>
            {lesson.description && (
              <p className="text-sm text-[#737373] mt-1 line-clamp-2">{lesson.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={isPending || cooldownActive}
          className={`mt-3 font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all duration-200 active:scale-[0.97] ${
            lesson.completed
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
              : 'bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]/85'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={cooldownActive ? `Watch the video before marking complete (${secondsLeft}s)` : undefined}
        >
          {lesson.completed ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </>
          ) : cooldownActive ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Watch first ({secondsLeft}s)
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

function ChapterAccordion({
  chapter,
  language,
  defaultOpen = true,
  locked = false,
  lockedReason,
}: {
  chapter: TrainingChapter;
  language: string;
  defaultOpen?: boolean;
  locked?: boolean;
  lockedReason?: string;
}) {
  const [expanded, setExpanded] = useState(defaultOpen && !locked);
  const isComplete = chapter.completed_count === chapter.total_count && chapter.total_count > 0;

  return (
    <div
      className={`rounded-2xl border bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
        locked ? 'border-[#E7E7EA] opacity-60' : 'border-[#E7E7EA]'
      }`}
      title={locked ? lockedReason : undefined}
    >
      <button
        onClick={() => !locked && setExpanded(!expanded)}
        disabled={locked}
        className={`w-full px-5 sm:px-6 py-5 flex items-center gap-4 text-left transition-colors ${
          locked ? 'cursor-not-allowed' : 'hover:bg-[#F5F5F6]'
        }`}
      >
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
            locked ? 'bg-gray-100 text-gray-400' : isComplete ? 'bg-emerald-50 text-emerald-600' : 'tint-purple'
          }`}
          style={!locked && !isComplete ? { color: 'var(--tint-icon)' } : undefined}
        >
          {locked ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ) : isComplete ? (
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
          <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a] truncate">
            {chapter.title}
          </h3>
          {chapter.description && (
            <p className="text-sm text-[#737373] mt-0.5 truncate">{chapter.description}</p>
          )}
          {locked && lockedReason ? (
            <p className="mt-2 text-xs text-amber-700">{lockedReason}</p>
          ) : (
            <div className="mt-2.5 max-w-md">
              <ProgressBar
                completed={chapter.completed_count}
                total={chapter.total_count}
                color={isComplete ? 'purple' : 'rainbow'}
              />
            </div>
          )}
        </div>
        {!locked && (
          <svg
            className={`w-5 h-5 text-[#a3a3a3] flex-shrink-0 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {!locked && expanded && chapter.lessons.length > 0 && (
        <div className="px-5 sm:px-6 pb-6 grid gap-4 sm:grid-cols-2">
          {chapter.lessons.map((lesson, idx) => (
            <LessonCard key={lesson.id} lesson={lesson} index={idx} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}

function CountdownChip({ course, now }: { course: TrainingCourse; now: Date }) {
  const remaining = formatRemaining(course.expires_at, now);
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-[#E7E7EA] bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      style={{
        backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #FFF27A, #0A0A0A, #737373)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        border: '1.5px solid transparent',
      }}
    >
      <svg className="h-3.5 w-3.5 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-[family-name:var(--font-inter)] text-[12px] font-medium text-[#0a0a0a] truncate max-w-[180px]">
        {course.title}
      </span>
      <span className="font-[family-name:var(--font-inter)] text-[12px] font-semibold text-[#525252] whitespace-nowrap">
        {remaining}
      </span>
    </div>
  );
}

function CountdownChips({ courses }: { courses: TrainingCourse[] }) {
  const now = useNow(60_000);
  const active = getActiveCountdowns(courses);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map((course) => (
        <CountdownChip key={course.id} course={course} now={now} />
      ))}
    </div>
  );
}

function ReopenRequestBanner({ courseId }: { courseId: string }) {
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [alreadyPending, setAlreadyPending] = useState(false);
  const requestReopen = useRequestCourseReopen();

  const handleSubmit = async () => {
    try {
      const result = await requestReopen.mutateAsync({ courseId, reason: reason.trim() || undefined });
      setSubmitted(true);
      setAlreadyPending(!!result.already);
    } catch {
      // toast will handle error display via the mutation's error state below
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <span className="font-semibold">
          {alreadyPending ? 'You already have a pending request.' : 'Request sent.'}
        </span>{' '}
        An admin will review it shortly.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      <div>
        <span className="font-semibold">Deadline passed.</span> Request to reopen this course below.
      </div>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why do you need this reopened? (optional)"
        rows={2}
        maxLength={500}
        className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-rose-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
      />
      <div className="flex items-center justify-between gap-3">
        {requestReopen.isError && (
          <span className="text-xs text-rose-700">
            {(requestReopen.error as any)?.response?.data?.message ?? 'Could not send request.'}
          </span>
        )}
        <button
          onClick={handleSubmit}
          disabled={requestReopen.isPending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
        >
          {requestReopen.isPending ? 'Sending…' : 'Request to reopen course'}
        </button>
      </div>
    </div>
  );
}

function CourseSection({
  course,
  enforceSequential,
  defaultOpenFirst = false,
}: {
  course: TrainingCourse;
  enforceSequential: boolean;
  defaultOpenFirst?: boolean;
}) {
  const availableLanguages = getCourseLanguages(course);
  const [language, setLanguage, hasSelectedLanguage] = useCourseLanguage(course.id, availableLanguages);
  const needsLanguageSelection = availableLanguages.length > 1 && !hasSelectedLanguage;
  const [popupDismissed, setPopupDismissed] = useState(false);

  // Show the start popup whenever the course needs starting and the user
  // hasn't dismissed it this session. Once started (server-side), the
  // popup naturally unmounts because course.started_at becomes truthy.
  const needsStart = course.countdown_enabled && !course.started_at && !course.expired;
  const showPopup = needsStart && !popupDismissed;

  return (
    <section className="space-y-4">
      {showPopup && <CourseStartPopup course={course} onDismiss={() => setPopupDismissed(true)} />}

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
            {course.title}
          </h2>
          {course.description && (
            <p className="mt-1 text-sm text-[#737373]">{course.description}</p>
          )}
        </div>
        <LanguagePicker
          language={language}
          available={availableLanguages}
          onChange={setLanguage}
          highlight={needsLanguageSelection}
        />
      </div>

      {course.expired && <ReopenRequestBanner courseId={course.id} />}

      {needsStart && !showPopup && (
        <div className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] px-4 py-3 text-sm text-[#525252]">
          Click <button onClick={() => setPopupDismissed(false)} className="text-[#0a0a0a] font-medium underline-offset-2 hover:underline">Start course</button> to begin.
        </div>
      )}

      {needsLanguageSelection ? (
        <LanguageSelectionPrompt />
      ) : course.chapters.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white px-6 py-8 text-center text-sm text-[#737373]">
          No chapters yet.
        </div>
      ) : (
        <div className="space-y-4">
          {course.chapters.map((chapter, i) => {
            const sequentialLocked = enforceSequential && chapter.unlocked === false;
            const expiredLocked = course.expired;
            const notStartedLocked = needsStart;
            const locked = sequentialLocked || expiredLocked || notStartedLocked;
            const previousTitle = i > 0 ? course.chapters[i - 1].title : null;
            let lockedReason: string | undefined;
            if (expiredLocked) lockedReason = "This course's deadline has passed. Use the request above to reopen.";
            else if (notStartedLocked) lockedReason = 'Click Start to begin this course';
            else if (sequentialLocked && previousTitle) lockedReason = `Complete "${previousTitle}" to unlock`;
            return (
              <div key={chapter.id} className={`stagger-${Math.min(i + 1, 6)}`}>
                <ChapterAccordion
                  chapter={chapter}
                  language={language}
                  locked={locked}
                  lockedReason={lockedReason}
                  defaultOpen={defaultOpenFirst && i === 0 && !locked}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OnboardingTraining() {
  const router = useRouter();
  const { data: courses = [], isLoading } = useOnboardingCourses();
  const completeOnboarding = useCompleteOnboarding();
  const activeCountdowns = getActiveCountdowns(courses);

  const totals = courses.reduce(
    (acc, course) => ({
      completed: acc.completed + course.completed_count,
      total: acc.total + course.total_count,
    }),
    { completed: 0, total: 0 },
  );
  const allComplete = totals.total > 0 && totals.completed === totals.total;

  // Auto-unlock: the moment every onboarding lesson is complete, flip the
  // onboarding flag automatically so the account unlocks without needing a
  // separate "Build Profile" click. Fires once per mount; the ref guard
  // prevents duplicate mutations while the request is in flight. If it fails
  // the manual "Build Profile" button below stays as a fallback.
  const autoUnlockFired = useRef(false);
  useEffect(() => {
    if (allComplete && !autoUnlockFired.current && !completeOnboarding.isPending) {
      autoUnlockFired.current = true;
      completeOnboarding.mutateAsync().catch(() => {
        // leave the flag set; the explicit button remains available to retry
      });
    }
  }, [allComplete, completeOnboarding]);

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
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">Onboarding</span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Complete the <span className="text-rainbow">Training</span> to Unlock Your Account
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] max-w-xl stagger-3">
              Watch the videos in each chapter and mark them complete to unlock the next chapter and the rest of your account.
            </p>
          </div>
        </div>
      </section>

      {activeCountdowns.length > 0 && (
        <CountdownChips courses={activeCountdowns} />
      )}

      {isLoading ? (
        <div className="h-32 bg-[#f0f0f0] rounded-2xl animate-pulse" />
      ) : courses.length === 0 ? (
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
              No onboarding content yet
            </h3>
            <p className="mt-1 text-sm text-[#737373]">Check back soon — your admin is setting things up.</p>
          </div>
        </div>
      ) : (
        <>
          {courses.map((course) => (
            <CourseSection
              key={course.id}
              course={course}
              enforceSequential
              defaultOpenFirst
            />
          ))}

          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            {allComplete ? (
              <>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
                  Training Complete!
                </h3>
                <p className="mt-1 text-sm text-[#737373] max-w-sm mx-auto">
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
                <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
                  Complete all chapters to unlock
                </h3>
                <p className="mt-1 text-sm text-[#737373]">
                  {totals.completed} of {totals.total} lessons complete
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
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;

  if (!onboarded) return <OnboardingTraining />;

  return <FullTrainingProgram />;
}

type CatalogStatus = 'not_started' | 'in_progress' | 'completed';

function courseStatus(course: TrainingCourse): CatalogStatus {
  if (course.total_count > 0 && course.completed_count >= course.total_count) return 'completed';
  if (course.completed_count > 0 || course.started_at) return 'in_progress';
  return 'not_started';
}

function courseProgressPct(course: TrainingCourse): number {
  if (course.total_count <= 0) return 0;
  return Math.min(100, Math.round((100 * course.completed_count) / course.total_count));
}

function FullTrainingProgram() {
  const searchParams = useSearchParams();
  const { data, isLoading } = useMyTraining();
  const courses = data?.courses ?? [];
  const legacyChapters = data?.chapters ?? [];
  const sops = data?.sops ?? [];
  const activeCountdowns = getActiveCountdowns(courses);

  const [query, setQuery] = useState('');
  const [openSopId, setOpenSopId] = useState<string | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [viewingLegacy, setViewingLegacy] = useState(false);

  // Deep link: /talent/training?resource=sop:<id> | course:<id>
  useEffect(() => {
    const resource = searchParams.get('resource');
    if (!resource) return;
    if (resource.startsWith('sop:')) {
      setOpenSopId(resource.slice(4));
      setViewingCourseId(null);
      setViewingLegacy(false);
    } else if (resource.startsWith('course:')) {
      setViewingCourseId(resource.slice(7));
      setOpenSopId(null);
      setViewingLegacy(false);
    }
  }, [searchParams]);

  const q = query.trim().toLowerCase();

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (c) =>
          !q ||
          c.title.toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q) ||
          (c.categories ?? []).some((cat) => cat.name.toLowerCase().includes(q)),
      ),
    [courses, q],
  );

  const filteredSops = useMemo(
    () =>
      sops.filter(
        (s) =>
          !q ||
          s.title.toLowerCase().includes(q) ||
          (s.summary ?? '').toLowerCase().includes(q),
      ),
    [sops, q],
  );

  const filteredLegacy = useMemo(
    () =>
      legacyChapters.filter(
        (ch) =>
          !q ||
          ch.title.toLowerCase().includes(q) ||
          (ch.description ?? '').toLowerCase().includes(q),
      ),
    [legacyChapters, q],
  );

  const stats = useMemo(() => {
    let inProgress = 0;
    let assigned = 0;
    let completed = 0;
    for (const c of courses) {
      const st = courseStatus(c);
      if (st === 'completed') completed += 1;
      else if (st === 'in_progress') inProgress += 1;
      else assigned += 1;
    }
    for (const s of sops) {
      if (s.completed) completed += 1;
      else if (s.assignment_status === 'in_progress') inProgress += 1;
      else assigned += 1;
    }
    return { inProgress, assigned, completed };
  }, [courses, sops]);

  const lessonTotals = useMemo(() => {
    let completed = 0;
    let total = 0;
    for (const course of courses) {
      completed += course.completed_count;
      total += course.total_count;
    }
    for (const ch of legacyChapters) {
      completed += ch.completed_count;
      total += ch.total_count;
    }
    for (const sop of sops) {
      total += 1;
      if (sop.completed) completed += 1;
    }
    return { completed, total };
  }, [courses, legacyChapters, sops]);

  const overallPct =
    lessonTotals.total > 0
      ? Math.round((lessonTotals.completed / lessonTotals.total) * 100)
      : 0;

  const isEmpty = courses.length === 0 && legacyChapters.length === 0 && sops.length === 0;
  const viewingCourse = courses.find((c) => c.id === viewingCourseId) ?? null;

  // Drill into a course — keep full chapter/lesson player
  if (viewingCourse) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setViewingCourseId(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#525252] hover:text-[#0a0a0a]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Training
        </button>
        {activeCountdowns.some((c) => c.id === viewingCourse.id) && (
          <CountdownChips courses={activeCountdowns.filter((c) => c.id === viewingCourse.id)} />
        )}
        <CourseSection
          course={viewingCourse}
          enforceSequential={viewingCourse.is_onboarding}
          defaultOpenFirst
        />
      </div>
    );
  }

  // Legacy chapters drill-in
  if (viewingLegacy) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setViewingLegacy(false)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#525252] hover:text-[#0a0a0a]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Training
        </button>
        <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
          Other chapters
        </h2>
        <div className="space-y-4">
          {legacyChapters.map((chapter) => (
            <ChapterAccordion key={chapter.id} chapter={chapter} language="en" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-0">
      {/* Resources-style hero */}
      <header className="border-b border-[#E7E7EA] pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-jakarta)] text-[32px] sm:text-[36px] font-semibold tracking-[-0.02em] leading-tight text-[#0a0a0a]">
              Training
            </h1>
            <p className="mt-1 text-[13px] text-[#737373]">
              Courses, systems and procedures shared with you.
            </p>
          </div>
          {lessonTotals.total > 0 && (
            <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E7E7EA" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#train-catalog-grad)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallPct / 100) * 264} 264`}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="train-catalog-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FFF27A" />
                    <stop offset="50%" stopColor="#0A0A0A" />
                    <stop offset="100%" stopColor="#737373" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                {overallPct}%
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-5">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses, systems and procedures…"
            className="w-full rounded-[10px] border border-[#E7E7EA] bg-white py-[10px] pl-10 pr-3 text-[13.5px] text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10"
          />
        </div>

        {/* Stat strip */}
        {!isEmpty && !q && (
          <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-[#E7E7EA] bg-[#E7E7EA]">
            <CatalogStat label="In progress" value={stats.inProgress} />
            <CatalogStat label="Assigned" value={stats.assigned} />
            <CatalogStat label="Completed" value={stats.completed} accent="emerald" />
          </div>
        )}
      </header>

      {activeCountdowns.length > 0 && !q && (
        <div className="pt-5">
          <CountdownChips courses={activeCountdowns} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 pt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#f0f0f0]" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="pt-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFAC2] text-xl">
            📚
          </div>
          <p className="text-[13px] text-[#737373]">
            Courses, systems and procedures shared with you will appear here.
          </p>
        </div>
      ) : q &&
        filteredCourses.length === 0 &&
        filteredSops.length === 0 &&
        filteredLegacy.length === 0 ? (
        <div className="pt-12 text-center text-[13px] text-[#737373]">
          <div className="mb-1 text-2xl">🔍</div>
          No matches for “{query.trim()}”. Try another term.
        </div>
      ) : (
        <div className="pb-8">
          {/* Active courses first */}
          {filteredCourses.filter((c) => courseStatus(c) !== 'completed').length > 0 && (
            <CatalogSection title="Courses">
              {filteredCourses
                .filter((c) => courseStatus(c) !== 'completed')
                .map((course) => (
                  <CatalogCourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => setViewingCourseId(course.id)}
                  />
                ))}
            </CatalogSection>
          )}

          {/* Systems and Procedures — always visible as a section when not searching empty */}
          <CatalogSection
            title="Systems and Procedures"
            empty={
              filteredSops.length === 0
                ? q
                  ? null
                  : sops.length === 0
                    ? 'Guides and procedures shared with you will show up here.'
                    : null
                : null
            }
          >
            {filteredSops
              .filter((s) => !s.completed)
              .map((sop) => (
                <CatalogSopCard key={sop.id} sop={sop} onOpen={() => setOpenSopId(sop.id)} />
              ))}
          </CatalogSection>

          {/* Legacy chapters as a catalog card */}
          {filteredLegacy.length > 0 && (
            <CatalogSection title="Other chapters">
              <button
                type="button"
                onClick={() => setViewingLegacy(true)}
                className="group flex w-full items-center gap-3 rounded-xl border border-[#E7E7EA] bg-white p-3 text-left transition hover:border-[#a3a3a3] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)] sm:col-span-2"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#F5F5F6] text-xl">
                  📑
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">
                    {filteredLegacy.length} standalone chapter
                    {filteredLegacy.length === 1 ? '' : 's'}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-[#737373]">
                    {filteredLegacy.map((c) => c.title).join(' · ')}
                  </span>
                </span>
                <svg
                  className="h-4 w-4 shrink-0 text-[#a3a3a3] transition group-hover:text-[#0a0a0a]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </CatalogSection>
          )}

          {/* Completed */}
          {(filteredCourses.some((c) => courseStatus(c) === 'completed') ||
            filteredSops.some((s) => s.completed)) && (
            <CatalogSection title="Completed">
              {filteredCourses
                .filter((c) => courseStatus(c) === 'completed')
                .map((course) => (
                  <CatalogCourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => setViewingCourseId(course.id)}
                  />
                ))}
              {filteredSops
                .filter((s) => s.completed)
                .map((sop) => (
                  <CatalogSopCard key={sop.id} sop={sop} onOpen={() => setOpenSopId(sop.id)} />
                ))}
            </CatalogSection>
          )}

          {!q &&
            stats.inProgress === 0 &&
            stats.assigned === 0 &&
            stats.completed > 0 && (
              <p className="mt-10 text-center text-[13px] text-[#737373]">
                🎉 You&apos;re all caught up. Search above to revisit anything shared with you.
              </p>
            )}
        </div>
      )}

      {openSopId && <SopReader sopId={openSopId} onClose={() => setOpenSopId(null)} />}
    </div>
  );
}

function CatalogStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'emerald';
}) {
  return (
    <div className="bg-white px-4 py-3">
      <div
        className={`font-[family-name:var(--font-jakarta)] text-[26px] leading-none font-semibold ${
          accent === 'emerald' ? 'text-emerald-600' : 'text-[#0a0a0a]'
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-[#a3a3a3]">{label}</div>
    </div>
  );
}

function CatalogSection({
  title,
  children,
  empty,
}: {
  title: string;
  children?: ReactNode;
  empty?: string | null;
}) {
  const hasKids = Array.isArray(children)
    ? (children as ReactNode[]).filter(Boolean).length > 0
    : !!children;
  if (!hasKids && !empty) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
        {title}
      </h2>
      {hasKids ? (
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      ) : empty ? (
        <p className="rounded-xl border border-dashed border-[#E7E7EA] bg-white px-4 py-6 text-center text-[12.5px] text-[#a3a3a3]">
          {empty}
        </p>
      ) : null}
    </section>
  );
}

function CatalogCourseCard({
  course,
  onOpen,
}: {
  course: TrainingCourse;
  onOpen: () => void;
}) {
  const status = courseStatus(course);
  const pct = courseProgressPct(course);
  const catLabel = course.categories?.[0]?.name;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-3 rounded-xl border border-[#E7E7EA] bg-white p-3 text-left transition hover:border-[#a3a3a3] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#FFFAC2] text-xl">
        {status === 'completed' ? '✓' : course.is_onboarding ? '🚀' : '📚'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#F5F5F6] px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-[#737373]">
            {course.is_onboarding ? 'Onboarding' : 'Course'}
          </span>
          {catLabel && (
            <span className="truncate text-[10px] text-[#a3a3a3]">{catLabel}</span>
          )}
          {status === 'in_progress' && (
            <span className="rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-medium text-amber-700">
              In progress
            </span>
          )}
          {status === 'completed' && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-medium text-emerald-700">
              Done
            </span>
          )}
        </span>
        <span className="truncate text-[13.5px] font-semibold leading-tight text-[#0a0a0a]">
          {course.title}
        </span>
        <span className="flex items-center gap-2 pt-0.5">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#E7E7EA]">
            <span
              className={`block h-full rounded-full transition-all ${
                status === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-[#FFF27A] via-[#0A0A0A] to-[#737373]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-[#a3a3a3]">
            {status === 'completed' ? '✓' : `${course.completed_count}/${course.total_count}`}
          </span>
        </span>
      </span>
    </button>
  );
}

function CatalogSopCard({
  sop,
  onOpen,
}: {
  sop: TrainingSopSummary;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-center gap-3 rounded-xl border border-[#E7E7EA] bg-white p-3 text-left transition hover:border-[#a3a3a3] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]"
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg text-xl ${
          sop.completed ? 'bg-emerald-50' : 'bg-[#F5F5F6]'
        }`}
      >
        {sop.completed ? '✓' : sop.icon || '📄'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[#F5F5F6] px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-[#737373]">
            Guide
          </span>
          {sop.completed ? (
            <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[9px] font-medium text-emerald-700">
              Done
            </span>
          ) : sop.assignment_status === 'in_progress' ? (
            <span className="rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-medium text-amber-700">
              In progress
            </span>
          ) : (
            <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[9px] font-medium text-indigo-700">
              Assigned
            </span>
          )}
        </span>
        <span className="truncate text-[13.5px] font-semibold leading-tight text-[#0a0a0a]">
          {sop.title}
        </span>
        {sop.summary ? (
          <span className="truncate text-[11.5px] leading-tight text-[#737373]">{sop.summary}</span>
        ) : (
          <span className="text-[11.5px] text-[#a3a3a3]">Open to review & mark complete</span>
        )}
      </span>
    </button>
  );
}
