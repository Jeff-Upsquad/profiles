'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMyTraining,
  useOnboardingCourses,
  useCompleteOnboarding,
  useMarkLessonComplete,
  useMarkLessonIncomplete,
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
} from '@/hooks/useTraining';
import CourseStartPopup from './CourseStartPopup';

function loomEmbedUrl(shareUrl: string): string {
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
            : 'border-[#E8E5DE]'
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
    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[#0a0a0a]/40 bg-gradient-to-br from-[#F2FCBC]/60 to-white px-6 py-10 sm:py-8 text-center sm:text-left">
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
              ? 'bg-gradient-to-r from-[#FF8B47] via-[#D24DFF] to-[#5BB7FF]'
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

function LessonCard({ lesson, index, language }: { lesson: TrainingLesson; index: number; language: string }) {
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
    <div className="group rounded-2xl border border-[#E8E5DE] overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
      <div className="aspect-video bg-[#09090B] relative">
        <iframe
          src={loomEmbedUrl(videoUrl)}
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
        locked ? 'border-[#E8E5DE] opacity-60' : 'border-[#E8E5DE]'
      }`}
      title={locked ? lockedReason : undefined}
    >
      <button
        onClick={() => !locked && setExpanded(!expanded)}
        disabled={locked}
        className={`w-full px-5 sm:px-6 py-5 flex items-center gap-4 text-left transition-colors ${
          locked ? 'cursor-not-allowed' : 'hover:bg-[#F7F6F3]'
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
      className="flex items-center gap-2 rounded-full border border-[#E8E5DE] bg-white px-3 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      style={{
        backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #FF8B47, #D24DFF, #5BB7FF)',
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
        border: '1.5px solid transparent',
      }}
    >
      <svg className="h-3.5 w-3.5 text-[#D24DFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      {course.expired && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="font-semibold">Deadline passed.</span> Contact support to reopen this course.
        </div>
      )}

      {needsStart && !showPopup && (
        <div className="rounded-xl border border-[#E8E5DE] bg-[#F7F6F3] px-4 py-3 text-sm text-[#525252]">
          Click <button onClick={() => setPopupDismissed(false)} className="text-[#0a0a0a] font-medium underline-offset-2 hover:underline">Start course</button> to begin.
        </div>
      )}

      {needsLanguageSelection ? (
        <LanguageSelectionPrompt />
      ) : course.chapters.length === 0 ? (
        <div className="rounded-2xl border border-[#E8E5DE] bg-white px-6 py-8 text-center text-sm text-[#737373]">
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
            if (expiredLocked) lockedReason = "This course's deadline has passed. Contact support to reopen.";
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
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
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
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2FCBC]">
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

          <div className="rounded-2xl border border-[#E8E5DE] bg-white p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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
  const onboarded = user?.onboarding_completed !== false;

  if (!onboarded) return <OnboardingTraining />;

  return <FullTrainingProgram />;
}

function FullTrainingProgram() {
  const { data, isLoading } = useMyTraining();
  const courses = data?.courses ?? [];
  const legacyChapters = data?.chapters ?? [];
  const activeCountdowns = getActiveCountdowns(courses);

  // Compute totals across all courses + legacy chapters
  const totals = (() => {
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
    return { completed, total };
  })();
  const overallPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  const isEmpty = courses.length === 0 && legacyChapters.length === 0;

  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {totals.completed} of {totals.total} lessons complete
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              <span className="text-rainbow">Training</span> Program.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Short videos to help you build a stronger profile and win more work.
            </p>
          </div>
          {totals.total > 0 && (
            <div className="relative flex h-16 w-16 items-center justify-center stagger-4">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E8E5DE" strokeWidth="9" />
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
              <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                {overallPct}%
              </span>
            </div>
          )}
        </div>
      </section>

      {activeCountdowns.length > 0 && (
        <CountdownChips courses={activeCountdowns} />
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-[#f0f0f0] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2FCBC]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              No training content yet
            </h3>
            <p className="mt-1 text-sm text-[#737373]">Check back soon for new chapters and lessons.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {courses.map((course) => (
            <CourseSection
              key={course.id}
              course={course}
              enforceSequential={course.is_onboarding}
            />
          ))}
          {legacyChapters.length > 0 && (
            <section className="space-y-4">
              {courses.length > 0 && (
                <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                  Other chapters
                </h2>
              )}
              <div className="space-y-4">
                {legacyChapters.map((chapter, i) => (
                  <div key={chapter.id} className={`stagger-${Math.min(i + 1, 6)}`}>
                    <ChapterAccordion chapter={chapter} language="en" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
