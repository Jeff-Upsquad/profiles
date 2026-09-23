'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMyTraining,
  useOnboardingCourses,
  useCompleteOnboarding,
  useMarkLessonComplete,
  useMarkLessonIncomplete,
  useRequestCourseReopen,
  useTrainingWebinars,
  useRegisterWebinar,
  useUnregisterWebinar,
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
  type TrainingWebinar,
} from '@/hooks/useTraining';
import toast from 'react-hot-toast';
import CourseStartPopup from './CourseStartPopup';
import ContentBlocks, { collectHeadings, type OutlineHeading } from '@/components/training/ContentBlocks';

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

function OnboardingTraining({ routeCourseId }: { routeCourseId: string | null }) {
  const router = useRouter();
  const { data: courses = [], isLoading } = useOnboardingCourses();
  const completeOnboarding = useCompleteOnboarding();

  const totals = courses.reduce(
    (acc, course) => ({
      completed: acc.completed + course.completed_count,
      total: acc.total + course.total_count,
    }),
    { completed: 0, total: 0 },
  );
  const allComplete = totals.total > 0 && totals.completed === totals.total;
  const activeCourse = courses.find(
    (course) => course.total_count > 0 && course.completed_count < course.total_count,
  ) ?? courses[0] ?? null;

  // New talents land on /talent/training. Move them to the dedicated reader
  // URL so DashboardLayout gives the onboarding course the full-width shell.
  // When several onboarding courses exist, continue with the first unfinished
  // one instead of falling back to the retired accordion page.
  useEffect(() => {
    if (isLoading || !activeCourse) return;
    if (routeCourseId !== activeCourse.id) {
      router.replace(`/talent/training/${activeCourse.id}`);
    }
  }, [activeCourse, isLoading, routeCourseId, router]);

  // Auto-unlock as soon as all onboarding lessons are complete. The banner in
  // the reader keeps an explicit retry available if this request fails.
  const autoUnlockFired = useRef(false);
  useEffect(() => {
    if (allComplete && !autoUnlockFired.current && !completeOnboarding.isPending) {
      autoUnlockFired.current = true;
      completeOnboarding.mutateAsync().catch(() => undefined);
    }
  }, [allComplete, completeOnboarding]);

  const handleBuildProfile = async () => {
    try {
      await completeOnboarding.mutateAsync();
      router.push('/talent/basic-profile');
    } catch {
      // The completion banner remains visible so the talent can retry.
    }
  };

  if (isLoading || (activeCourse && routeCourseId !== activeCourse.id)) {
    return <div className="min-h-0 flex-1 animate-pulse bg-[#f0f0f0]" />;
  }

  if (!activeCourse) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-white px-6 text-center">
        <div>
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
    );
  }

  return (
    <CourseReader
      course={activeCourse}
      enforceSequential
      onBack={() => router.push('/talent/dashboard')}
      completionBanner={allComplete ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 md:px-5">
          <span>
            <span className="font-semibold">Training complete.</span>{' '}
            {completeOnboarding.isError ? 'We could not unlock your account automatically.' : 'Unlocking your account…'}
          </span>
          <button
            type="button"
            onClick={handleBuildProfile}
            disabled={completeOnboarding.isPending}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
          >
            {completeOnboarding.isPending ? 'Unlocking…' : 'Continue to profile'}
          </button>
        </div>
      ) : null}
    />
  );
}

export default function TrainingProgram() {
  const { user } = useAuth();
  const routeCourseId = (useParams()?.courseId as string | undefined) ?? null;
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;

  if (!onboarded) return <OnboardingTraining routeCourseId={routeCourseId} />;

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

/**
 * Reader width (not viewport width) at which the on-this-page rail is pinned
 * beside the lesson. Must stay in step with the `@[1000px]:` container-query
 * classes in CourseReader.
 */
const OUTLINE_PIN_WIDTH = 1000;

/* ================================================================== */
/* Course reader — the SOP document shell from SquadHub's              */
/* LearningItemView: a slim top bar, then three columns —              */
/*   left   chapter / lesson rail (own scroll)                         */
/*   middle the active lesson body (own scroll)                        */
/*   right  on-this-page heading outline (own scroll)                  */
/* It fills the viewport: DashboardLayout gives /talent/training/<id>  */
/* the same full-bleed treatment as a message thread, so the rails get */
/* real width instead of being squeezed inside max-w-5xl.              */
/* ================================================================== */

/** Right rail — jump list built from the lesson's heading blocks. */
function OnThisPage({
  headings,
  scrollRef,
  scanKey,
}: {
  headings: OutlineHeading[];
  scrollRef: React.RefObject<HTMLElement | null>;
  scanKey: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Scroll-spy against the lesson column (not the window — each column
  // scrolls independently in this shell).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || headings.length === 0) {
      setActiveId(null);
      return;
    }
    const onScroll = () => {
      const rootTop = root.getBoundingClientRect().top;
      let current = headings[0].id;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - rootTop <= 88) current = heading.id;
        else break;
      }
      setActiveId(current);
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [scrollRef, headings, scanKey]);

  const jumpTo = (id: string) => {
    const root = scrollRef.current;
    const el = document.getElementById(id);
    if (!root || !el) return;
    const top =
      el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 16;
    root.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  return (
    <div className="px-3 py-4">
      <div className="px-1.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
        On this page
      </div>
      {headings.length === 0 ? (
        <p className="px-1.5 py-2 text-[11.5px] leading-snug text-[#a3a3a3]">
          No sections on this page.
        </p>
      ) : (
        <ul className="border-l border-[#E7E7EA]">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            return (
              <li key={heading.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(heading.id)}
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                  className={`-ml-px block w-full border-l py-2 pr-2 text-left text-[12px] leading-snug transition ${
                    isActive
                      ? 'border-[#0a0a0a] font-semibold text-[#0a0a0a]'
                      : 'border-transparent text-[#737373] hover:border-[#E7E7EA] hover:text-[#0a0a0a]'
                  }`}
                >
                  {heading.text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Left rail — chapters with their lessons, lock state and progress. */
function ChapterRail({
  course,
  lockedReasons,
  activeLessonId,
  onPick,
  pct,
}: {
  course: TrainingCourse;
  lockedReasons: (string | null)[];
  activeLessonId: string | null;
  onPick: (lessonId: string) => void;
  pct: number;
}) {
  return (
    <div className="px-3 py-4">
      <div className="flex items-center justify-between px-1.5 pb-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
          Chapters
        </span>
        <span className="text-[10.5px] tabular-nums text-[#a3a3a3]">
          {course.completed_count}/{course.total_count}
        </span>
      </div>
      <div className="mx-1.5 mb-3 h-1 overflow-hidden rounded-full bg-[#E7E7EA]">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-[#0a0a0a]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {course.chapters.map((chapter, ci) => {
        const lockedReason = lockedReasons[ci];
        const doneCount = chapter.lessons.filter((l) => l.completed).length;
        const chapterDone = chapter.total_count > 0 && doneCount >= chapter.total_count;
        // A section page can also be a lesson. Use its selectable lesson row
        // as the chapter label instead of repeating the same title above it.
        const chapterLesson = chapter.lessons.find((lesson) =>
          lesson.title.trim().toLowerCase() === chapter.title.trim().toLowerCase() &&
          (lesson.id === chapter.id || chapter.lessons.length === 1),
        );
        return (
          <div key={chapter.id} className="mb-3 last:mb-0">
            {!chapterLesson && <div className="flex items-center gap-2 px-2 pb-1">
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${
                  lockedReason
                    ? 'bg-[#E7E7EA] text-[#a3a3a3]'
                    : chapterDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-[#0a0a0a] text-white'
                }`}
              >
                {lockedReason ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : chapterDone ? (
                  '✓'
                ) : (
                  ci + 1
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#0a0a0a]">
                {chapter.title}
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-[#a3a3a3]">
                {doneCount}/{chapter.total_count}
              </span>
            </div>}
            <ul title={lockedReason ?? undefined}>
              {chapter.lessons.map((lesson) => {
                const isActive = lesson.id === activeLessonId;
                const isChapterLesson = lesson.id === chapterLesson?.id;
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => onPick(lesson.id)}
                      disabled={!!lockedReason}
                      aria-current={isActive ? 'page' : undefined}
                      title={lockedReason ?? lesson.title}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition ${
                        isActive
                          ? 'bg-[#0a0a0a] text-white'
                          : lockedReason
                            ? 'cursor-not-allowed text-[#a3a3a3]'
                            : 'text-[#0a0a0a] hover:bg-[#F0F0F0]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid shrink-0 place-items-center font-semibold ${isChapterLesson ? 'h-5 w-5 rounded-md text-[10px]' : 'h-4 w-4 rounded-full text-[9px]'} ${
                          lesson.completed
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? 'bg-white text-[#0a0a0a]'
                              : isChapterLesson && !lockedReason
                                ? 'bg-[#0a0a0a] text-white'
                                : 'bg-[#E7E7EA] text-[#525252]'
                        }`}
                      >
                        {lesson.completed ? '✓' : isChapterLesson ? ci + 1 : '•'}
                      </span>
                      <span className={`min-w-0 flex-1 truncate leading-snug ${isChapterLesson ? 'text-[12px] font-semibold' : 'text-[12.5px]'}`}>
                        {lesson.title}
                      </span>
                      {isChapterLesson && (
                        <span className={`shrink-0 text-[10px] tabular-nums ${isActive ? 'text-white/70' : 'text-[#a3a3a3]'}`}>
                          {doneCount}/{chapter.total_count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {lockedReason && (
              <p className="px-2 pb-1 pt-0.5 text-[10.5px] leading-snug text-amber-700">
                {lockedReason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CourseReader({
  course,
  enforceSequential,
  onBack,
  completionBanner,
}: {
  course: TrainingCourse;
  enforceSequential: boolean;
  onBack: () => void;
  completionBanner?: ReactNode;
}) {
  const availableLanguages = getCourseLanguages(course);
  const [language, setLanguage, hasSelectedLanguage] = useCourseLanguage(course.id, availableLanguages);
  const needsLanguageSelection = availableLanguages.length > 1 && !hasSelectedLanguage;
  const [popupDismissed, setPopupDismissed] = useState(false);
  const markComplete = useMarkLessonComplete();
  const markIncomplete = useMarkLessonIncomplete();
  const contentRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  const needsStart = course.countdown_enabled && !course.started_at && !course.expired;
  const showPopup = needsStart && !popupDismissed;

  // Same lock rules as CourseSection: deadline > not-started > sequential.
  const lockedReasons = useMemo(
    () =>
      course.chapters.map((chapter, i) => {
        if (course.expired)
          return "This course's deadline has passed. Use the request above to reopen.";
        if (needsStart) return 'Click Start to begin this course';
        if (enforceSequential && chapter.unlocked === false) {
          const previousTitle = i > 0 ? course.chapters[i - 1].title : null;
          return previousTitle
            ? `Complete "${previousTitle}" to unlock`
            : 'Complete the previous chapter to unlock';
        }
        return null;
      }),
    [course, enforceSequential, needsStart],
  );

  const flat = useMemo(
    () =>
      course.chapters.flatMap((chapter, chapterIndex) =>
        chapter.lessons.map((lesson) => ({ lesson, chapter, chapterIndex })),
      ),
    [course],
  );

  const defaultLessonId = useMemo(() => {
    const unlocked = flat.filter((entry) => !lockedReasons[entry.chapterIndex]);
    return (
      (unlocked.find((entry) => !entry.lesson.completed) ?? unlocked[0] ?? flat[0])
        ?.lesson.id ?? null
    );
  }, [flat, lockedReasons]);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  // Outline rail visibility. 'auto' is CSS-only: in-flow beside the lesson at
  // >=xl, absent below that (there isn't room for three columns). 'open' is an
  // explicit request, which below xl floats the rail over the lesson instead of
  // squeezing it. Tri-state rather than a boolean + matchMedia so the server
  // and client render the same thing.
  const [outlinePref, setOutlinePref] = useState<'auto' | 'open' | 'closed'>('auto');
  const resolvedId = activeLessonId ?? defaultLessonId;
  const activeIndex = flat.findIndex((entry) => entry.lesson.id === resolvedId);
  const active = activeIndex >= 0 ? flat[activeIndex] : null;

  const pct = courseProgressPct(course);
  const catLabel = course.categories?.[0]?.name;
  const showCountdown = course.countdown_enabled && course.started_at && !course.expired;

  // Watch-gate for the active lesson (mirrors LessonCard's 60s cooldown). It
  // only applies to lessons with a video — a blocks-only document has nothing
  // to watch, so it can be marked complete as soon as it is read.
  const videoUrl = active ? pickLessonUrl(active.lesson, language) : '';
  const blocks = useMemo(() => active?.lesson.blocks ?? [], [active?.lesson.blocks]);
  const hasVideo = !!videoUrl;
  const hasContent = hasVideo || blocks.length > 0;
  const [secondsLeft, setSecondsLeft] = useState(WATCH_COOLDOWN_SECONDS);
  useEffect(() => {
    setSecondsLeft(!videoUrl || active?.lesson.completed ? 0 : WATCH_COOLDOWN_SECONDS);
  }, [videoUrl, active?.lesson.completed]);
  useEffect(() => {
    if (!active || active.lesson.completed || !videoUrl) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [active, videoUrl]);
  const cooldownActive = !!active && !active.lesson.completed && hasVideo && secondsLeft > 0;
  const togglePending = markComplete.isPending || markIncomplete.isPending;
  const outline = useMemo(() => collectHeadings(blocks), [blocks]);
  // A video-only lesson has nothing to navigate in the outline. Keeping an
  // empty rail pinned makes the actual lesson needlessly narrow.
  const hasOutline = outline.length > 0;
  const showOutline = hasOutline && outlinePref !== 'closed';
  const outlineOverlay = outlinePref === 'open';

  // Whether the READER is wide enough for the rail to sit beside the lesson.
  // Measured on the reader itself rather than the viewport: the dashboard
  // sidebar eats 240px, so a viewport-width breakpoint fires ~240px later than
  // the layout actually needs — that gap is why a 1274px window showed no rail
  // at an `xl` (1280px) threshold. The CSS uses the matching @container query,
  // so the rail's visibility never flashes; this observer only backs the
  // toggle's label and pressed state, which CSS cannot express.
  const [wideEnough, setWideEnough] = useState<boolean | null>(null);
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWideEnough(entry.contentRect.width >= OUTLINE_PIN_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const outlineVisible =
    hasOutline && (outlinePref === 'open' || (outlinePref === 'auto' && wideEnough === true));

  // One button, the obvious meaning at both sizes: when the rail is already
  // pinned beside the lesson the button closes it; when it isn't shown, the
  // button opens it as an overlay. Measured fresh on click rather than read
  // from `wideEnough`, so the action stays correct even if the observer above
  // never delivered a callback.
  const toggleOutline = () =>
    setOutlinePref((pref) => {
      if (pref === 'open') return 'closed';
      if (pref === 'closed') return 'open';
      const width = shellRef.current?.getBoundingClientRect().width ?? 0;
      return width >= OUTLINE_PIN_WIDTH ? 'closed' : 'open';
    });

  // Switching lessons should start the new one at the top of its own column.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [resolvedId]);

  const goTo = (index: number) => {
    const entry = flat[index];
    if (!entry || lockedReasons[entry.chapterIndex]) return;
    setActiveLessonId(entry.lesson.id);
  };

  const toggleComplete = () => {
    if (!active || cooldownActive || togglePending) return;
    if (active.lesson.completed) markIncomplete.mutate(active.lesson.id);
    else markComplete.mutate(active.lesson.id);
  };

  const banners = (
    <>
      {showCountdown && (
        <div className="border-b border-[#E7E7EA] bg-white px-4 py-2.5 md:px-5">
          <CountdownChips courses={[course]} />
        </div>
      )}
      {course.expired && (
        <div className="border-b border-[#E7E7EA] bg-white px-4 py-2.5 md:px-5">
          <ReopenRequestBanner courseId={course.id} />
        </div>
      )}
      {needsStart && !showPopup && (
        <div className="border-b border-[#E7E7EA] bg-[#F5F5F6] px-4 py-2.5 text-sm text-[#525252] md:px-5">
          Click{' '}
          <button
            onClick={() => setPopupDismissed(false)}
            className="font-medium text-[#0a0a0a] underline-offset-2 hover:underline"
          >
            Start course
          </button>{' '}
          to begin.
        </div>
      )}
    </>
  );

  return (
    <div ref={shellRef} className="@container flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {showPopup && <CourseStartPopup course={course} onDismiss={() => setPopupDismissed(true)} />}

      {/* Top bar */}
      <div className="flex min-h-[52px] shrink-0 items-center gap-2 border-b border-[#E7E7EA] bg-white px-4 py-2.5 md:px-5">
        <button
          type="button"
          onClick={onBack}
          className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md text-[#525252] transition hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
          aria-label="Back to Training"
          title="Back to Training"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-[15px] leading-none">{course.is_onboarding ? '🚀' : '📚'}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-[#0a0a0a]">
            {course.title}
          </span>
          <span className="hidden truncate text-[10.5px] text-[#a3a3a3] sm:block">
            {course.is_onboarding ? 'Onboarding' : 'Course'}
            {catLabel ? ` · ${catLabel}` : ''}
            {course.description ? ` · ${course.description}` : ''}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-[11px] tabular-nums text-[#525252]">{pct}%</span>
            <span className="h-1 w-24 overflow-hidden rounded-full bg-[#E7E7EA]">
              <span
                className={`block h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-[#0a0a0a]'}`}
                style={{ width: `${pct}%` }}
              />
            </span>
          </span>
          {hasOutline && <button
            type="button"
            onClick={toggleOutline}
            aria-pressed={outlineVisible}
            title={outlineVisible ? 'Hide page outline' : 'Show page outline'}
            className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium transition sm:inline-flex ${
              outlinePref === 'open'
                ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                : outlinePref === 'auto'
                  ? 'border-[#E7E7EA] bg-white text-[#525252] hover:bg-[#F5F5F6] hover:text-[#0a0a0a] @[1000px]:border-[#0a0a0a] @[1000px]:bg-[#0a0a0a] @[1000px]:text-white'
                  : 'border-[#E7E7EA] bg-white text-[#525252] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]'
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 6h10M4 12h16M4 18h7" />
            </svg>
            Outline
          </button>}
          <LanguagePicker language={language} available={availableLanguages} onChange={setLanguage} />
        </span>
      </div>

      {banners}
      {completionBanner}

      {needsLanguageSelection ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <LanguageSelectionPrompt />
        </div>
      ) : course.chapters.length === 0 || flat.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-[#737373]">
          {course.program_track ? 'Content coming soon.' : 'No lessons yet.'}
        </div>
      ) : (
        <>
          {/* Mobile lesson picker — stands in for the left rail below md */}
          <div className="shrink-0 border-b border-[#E7E7EA] bg-[#FAFAFA] px-3 py-2 @[680px]:hidden">
            <label className="sr-only" htmlFor="course-lesson-picker">Lesson</label>
            <select
              id="course-lesson-picker"
              value={resolvedId ?? ''}
              onChange={(e) => setActiveLessonId(e.target.value)}
              className="w-full rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-[13px] font-medium text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
            >
              {course.chapters.map((chapter, ci) => (
                <optgroup
                  key={chapter.id}
                  label={chapter.lessons.some((lesson) => lesson.title.trim().toLowerCase() === chapter.title.trim().toLowerCase())
                    ? `Chapter ${ci + 1}`
                    : chapter.title}
                >
                  {chapter.lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id} disabled={!!lockedReasons[ci]}>
                      {lesson.completed ? '✓ ' : ''}{lesson.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* left rail | lesson | on-this-page */}
          <div className="grid min-h-0 flex-1 grid-cols-1 @[680px]:grid-cols-[248px_minmax(0,1fr)] @[1000px]:grid-cols-[264px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 overflow-y-auto border-r border-[#E7E7EA] bg-[#FAFAFA] @[680px]:block">
              <ChapterRail
                course={course}
                lockedReasons={lockedReasons}
                activeLessonId={resolvedId}
                onPick={setActiveLessonId}
                pct={pct}
              />
            </aside>

            <div
              className={`relative grid min-h-0 min-w-0 grid-cols-1 ${
                showOutline ? '@[1000px]:grid-cols-[minmax(0,1fr)_264px]' : ''
              }`}
            >
              <main ref={contentRef} className="course-lesson-scroll min-h-0 min-w-0 overflow-x-hidden overflow-y-auto scroll-smooth bg-white">
                {!active ? (
                  <div className="flex h-full items-center justify-center px-6 py-16 text-sm text-[#737373]">
                    Select a lesson to begin.
                  </div>
                ) : (
                  <article className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                      {course.title} › {active.chapter.title}
                    </p>
                    <p className="mt-2 text-[12px] font-medium uppercase tracking-wider text-[#525252]">
                      Lesson {activeIndex + 1} of {flat.length}
                    </p>
                    <h1 className="font-[family-name:var(--font-jakarta)] mt-1 text-[24px] font-semibold leading-tight tracking-[-0.015em] text-[#0a0a0a] sm:text-[28px]">
                      {active.lesson.title}
                    </h1>
                    {active.lesson.description && (
                      <p className="mt-2 text-sm leading-relaxed text-[#525252]">
                        {active.lesson.description}
                      </p>
                    )}

                    {hasVideo && (
                      <div className="mt-5 aspect-video overflow-hidden rounded-xl bg-[#09090B]">
                        <iframe
                          src={videoEmbedUrl(videoUrl)}
                          className="h-full w-full"
                          allowFullScreen
                          allow="autoplay; fullscreen; picture-in-picture"
                        />
                      </div>
                    )}

                    {blocks.length > 0 && (
                      <ContentBlocks blocks={blocks} language={language} className={hasVideo ? 'mt-6 space-y-5' : 'mt-5 space-y-5'} />
                    )}

                    {!hasContent && (
                      <div className="mt-5 rounded-xl border border-dashed border-[#E7E7EA] bg-[#FAFAFA] px-4 py-10 text-center text-sm text-[#a3a3a3]">
                        This lesson has no content yet.
                      </div>
                    )}

                    <div className="mt-10 flex items-center justify-between gap-3 border-t border-[#E7E7EA] pt-6">
                      <button
                        type="button"
                        onClick={() => goTo(activeIndex - 1)}
                        disabled={activeIndex <= 0}
                        className="rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#F5F5F6] disabled:opacity-30"
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        onClick={toggleComplete}
                        disabled={togglePending || cooldownActive}
                        title={cooldownActive ? `Watch the video before marking complete (${secondsLeft}s)` : undefined}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                          active.lesson.completed
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
                            : 'bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]/85'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {active.lesson.completed ? (
                          <>✓ Completed</>
                        ) : cooldownActive ? (
                          <>Watch first ({secondsLeft}s)</>
                        ) : togglePending ? (
                          <>Saving…</>
                        ) : (
                          <>Mark lesson complete</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(activeIndex + 1)}
                        disabled={
                          activeIndex >= flat.length - 1 ||
                          !!lockedReasons[flat[activeIndex + 1]?.chapterIndex]
                        }
                        className="rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#F5F5F6] disabled:opacity-30"
                      >
                        Next →
                      </button>
                    </div>
                  </article>
                )}
              </main>

              {/* Right rail. Pinned beside the lesson at >=xl; below that the
                  same panel floats over the lesson so a narrow window can still
                  reach it without squeezing the text column. */}
              {showOutline && (
                <aside
                  className={`${
                    outlineOverlay
                      ? 'absolute inset-y-0 right-0 z-20 w-[264px] max-w-[85%] shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)]'
                      : 'hidden'
                  } min-h-0 overflow-y-auto border-l border-[#E7E7EA] bg-[#FAFAFA] @[1000px]:static @[1000px]:z-auto @[1000px]:block @[1000px]:w-auto @[1000px]:max-w-none @[1000px]:shadow-none`}
                >
                  <div className="flex items-center justify-end px-2 pt-2 @[1000px]:hidden">
                    <button
                      type="button"
                      onClick={() => setOutlinePref('closed')}
                      aria-label="Hide page outline"
                      className="grid h-6 w-6 place-items-center rounded-md text-[#737373] transition hover:bg-[#E7E7EA] hover:text-[#0a0a0a]"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <OnThisPage
                    headings={outline}
                    scrollRef={contentRef}
                    scanKey={resolvedId ?? ''}
                  />
                </aside>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function FullTrainingProgram() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Present when mounted on /talent/training/<courseId> — the full-bleed
  // reader route. On the plain /talent/training list it is undefined.
  const routeCourseId = (useParams()?.courseId as string | undefined) ?? null;
  const { data, isLoading } = useMyTraining();
  const courses = data?.courses ?? [];
  const sops = data?.sops ?? [];
  const sopCourses = data?.sopCourses ?? [];
  const activeCountdowns = getActiveCountdowns(courses);

  const [query, setQuery] = useState('');
  const [viewingLegacy, setViewingLegacy] = useState(false);
  const viewingCourseId = routeCourseId;

  // Legacy deep link: /talent/training?resource=sop:<id> | course:<id>.
  // Both now have their own reader route.
  useEffect(() => {
    const resource = searchParams.get('resource');
    if (!resource) return;
    if (resource.startsWith('sop:')) {
      setViewingLegacy(false);
      router.replace(`/talent/training/${resource.slice(4)}`);
    } else if (resource.startsWith('course:')) {
      setViewingLegacy(false);
      router.replace(`/talent/training/${resource.slice(7)}`);
    }
  }, [searchParams, router]);

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
      ([] as TrainingChapter[]).filter(
        (ch) =>
          !q ||
          ch.title.toLowerCase().includes(q) ||
          (ch.description ?? '').toLowerCase().includes(q),
      ),
    [q],
  );

  const stats = useMemo(() => {
    let inProgress = 0;
    let assigned = 0;
    let completed = 0;
    for (const c of courses) {
      if (c.program_track && c.total_count === 0) continue;
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
    for (const ch of [] as TrainingChapter[]) {
      completed += ch.completed_count;
      total += ch.total_count;
    }
    for (const sop of sops) {
      total += 1;
      if (sop.completed) completed += 1;
    }
    return { completed, total };
  }, [courses, sops]);

  const overallPct =
    lessonTotals.total > 0
      ? Math.round((lessonTotals.completed / lessonTotals.total) * 100)
      : 0;

  const isEmpty = courses.length === 0 && sops.length === 0;
  // Courses and SOPs share one full-page reader — SOP items carry the same
  // chapter payload, so the lookup spans both lists.
  const viewingCourse =
    courses.find((c) => c.id === viewingCourseId) ??
    sopCourses.find((c) => c.id === viewingCourseId) ??
    null;

  // Drill into a course — the SOP-style reader (left rail | lesson | outline).
  // The parent shell is a flex column here, so the reader claims the remaining
  // height rather than sitting in the list page's spacing.
  if (viewingCourse) {
    return (
      <CourseReader
        course={viewingCourse}
        enforceSequential={viewingCourse.is_onboarding}
        onBack={() => router.push('/talent/training')}
      />
    );
  }

  // Still on the reader route but the course isn't in the payload — either the
  // training list is still loading, or the id is stale/not visible to this
  // talent. Never fall through to the list here: the full-bleed shell has no
  // padding and the list would render edge-to-edge.
  if (routeCourseId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        {isLoading ? (
          <div className="h-24 w-full max-w-md animate-pulse rounded-2xl bg-[#f0f0f0]" />
        ) : (
          <>
            <p className="text-sm text-[#525252]">
              This course isn&apos;t available on your account.
            </p>
            <button
              type="button"
              onClick={() => router.push('/talent/training')}
              className="rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0a0a0a]/85"
            >
              Back to Training
            </button>
          </>
        )}
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
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-0">
      {/* Compact hero — one slim row + inline search + chip stats */}
      <header className="border-b border-[#E7E7EA] pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em] leading-tight text-[#0a0a0a]">
              Training
            </h1>
            <p className="mt-0.5 text-[12px] text-[#737373]">
              Courses, guides and live webinars shared with you.
            </p>
          </div>
          {lessonTotals.total > 0 && (
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E7E7EA" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#train-catalog-grad)"
                  strokeWidth="12"
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
              <span className="font-[family-name:var(--font-jakarta)] text-[11px] font-semibold text-[#0a0a0a]">
                {overallPct}%
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-3">
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
            placeholder="Search courses, guides, webinars…"
            className="w-full rounded-[10px] border border-[#E7E7EA] bg-white py-2 pl-10 pr-3 text-[13px] text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10"
          />
        </div>

        {/* Compact stat strip — one inline row instead of a 3-cell grid */}
        {!isEmpty && !q && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-[#F5F5F6] px-2.5 py-1 font-medium text-[#525252]">
              {stats.inProgress} in progress
            </span>
            <span className="rounded-full bg-[#F5F5F6] px-2.5 py-1 font-medium text-[#525252]">
              {stats.assigned} assigned
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              {stats.completed} done
            </span>
          </div>
        )}
      </header>

      {activeCountdowns.length > 0 && !q && (
        <div className="pt-3">
          <CountdownChips courses={activeCountdowns} />
        </div>
      )}

      {!q && <WebinarsSection />}

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
        <div className="pb-4">
          {/* Active courses first */}
          {filteredCourses.filter((c) => courseStatus(c) !== 'completed').length > 0 && (
            <CatalogSection title="Courses">
              {filteredCourses
                .filter((c) => courseStatus(c) !== 'completed')
                .map((course) => (
                  <CatalogCourseCard
                    key={course.id}
                    course={course}
                    onOpen={() => router.push(`/talent/training/${course.id}`)}
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
                  <CatalogSopCard key={sop.id} sop={sop} onOpen={() => router.push(`/talent/training/${sop.id}`)} />

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

          {/* Completed — collapsed by default so the list stays short */}
          {(filteredCourses.some((c) => courseStatus(c) === 'completed') ||
            filteredSops.some((s) => s.completed)) && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3] hover:text-[#0a0a0a]">
                Completed (
                {filteredCourses.filter((c) => courseStatus(c) === 'completed').length +
                  filteredSops.filter((s) => s.completed).length}
                )
              </summary>
              <div className="mt-2 grid gap-2 pb-8 sm:grid-cols-2">
                {filteredCourses
                  .filter((c) => courseStatus(c) === 'completed')
                  .map((course) => (
                    <CatalogCourseCard
                      key={course.id}
                      course={course}
                      onOpen={() => router.push(`/talent/training/${course.id}`)}
                    />
                  ))}
                {filteredSops
                  .filter((s) => s.completed)
                  .map((sop) => (
                    <CatalogSopCard key={sop.id} sop={sop} onOpen={() => router.push(`/talent/training/${sop.id}`)} />
                  ))}
              </div>
            </details>
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
    </div>
  );
}

function formatWebinarWhen(startsAt: string, now: Date): string {
  const start = new Date(startsAt);
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return 'Live now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `In ${mins}m`;
  const hours = Math.floor(mins / 60);
  const sameDay = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === start.toDateString();
  const time = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  if (tomorrow) return `Tomorrow ${time}`;
  if (hours < 48) return `In ${hours}h`;
  return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

/** Compact Upcoming Webinars — one-click register, Join appears near start. */
function WebinarsSection() {
  const { data: webinars, isLoading } = useTrainingWebinars();
  const register = useRegisterWebinar();
  const unregister = useUnregisterWebinar();
  const now = useNow(30_000);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <section className="mt-4">
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
          Upcoming webinars
        </h2>
        <div className="h-14 animate-pulse rounded-xl bg-[#f0f0f0]" />
      </section>
    );
  }
  if (!webinars || webinars.length === 0) return null;

  const act = async (w: TrainingWebinar) => {
    if (busyId) return;
    setBusyId(w.id);
    try {
      if (w.registered) {
        await unregister.mutateAsync(w.id);
        toast.success('Unregistered');
      } else {
        await register.mutateAsync(w.id);
        toast.success("You're registered — we'll remind you on the day, 30 min and 5 min before.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not update registration');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
        Upcoming webinars
      </h2>
      <div className="space-y-2">
        {webinars.map((w) => {
          const startMs = new Date(w.starts_at).getTime();
          const joinable = w.registered && now.getTime() >= startMs - 15 * 60 * 1000;
          const busy = busyId === w.id;
          return (
            <div
              key={w.id}
              className="flex items-center gap-2.5 rounded-xl border border-[#E7E7EA] bg-white p-2.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFFAC2] text-base">
                🎥
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight text-[#0a0a0a]">
                  {w.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-[#737373]">
                  {formatWebinarWhen(w.starts_at, now)} · {LANGUAGE_LABELS[w.language] ?? w.language}
                  {w.registered && ' · Registered ✓'}
                </span>
              </span>
              {joinable && (
                <a
                  href={w.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg bg-[#0a0a0a] px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#0a0a0a]/85"
                >
                  Join
                </a>
              )}
              <button
                type="button"
                onClick={() => act(w)}
                disabled={busy}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-40 ${
                  w.registered
                    ? 'border border-[#E7E7EA] text-[#525252] hover:bg-[#F5F5F6]'
                    : 'bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]/85'
                }`}
              >
                {busy ? '…' : w.registered ? 'Registered' : 'Register'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-[#a3a3a3]">
        Registered talents get reminders on the day, 30 min and 5 min before — in notifications + WhatsApp.
      </p>
    </section>
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
    <section className="mt-4">
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
        {title}
      </h2>
      {hasKids ? (
        <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      ) : empty ? (
        <p className="rounded-xl border border-dashed border-[#E7E7EA] bg-white px-4 py-4 text-center text-[12.5px] text-[#a3a3a3]">
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
      className="group flex items-center gap-2.5 rounded-xl border border-[#E7E7EA] bg-white p-2.5 text-left transition hover:border-[#a3a3a3] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFFAC2] text-base">
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
          {course.program_track && course.total_count === 0 && (
            <span className="rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-medium text-amber-700">
              Content coming soon
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
        {course.program_track && course.total_count === 0 ? (
          <span className="text-[11px] text-[#737373]">Lessons will appear here when added.</span>
        ) : <span className="flex items-center gap-2 pt-0.5">
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
        </span>}
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
      className="group flex items-center gap-2.5 rounded-xl border border-[#E7E7EA] bg-white p-2.5 text-left transition hover:border-[#a3a3a3] hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]"
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${
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
