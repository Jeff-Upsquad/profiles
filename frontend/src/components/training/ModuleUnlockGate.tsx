'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useMyTraining,
  getAvailableLanguages,
  LANGUAGE_LABELS,
  type TrainingChapter,
} from '@/hooks/useTraining';
import { LessonCard } from '@/views/talent/TrainingProgram';

/**
 * Inline "locked module" view. When a talent opens a module that is gated
 * behind a training chapter they haven't finished (e.g. Subscriptions,
 * Assignments, Job Openings), we render this in place of the real module
 * page: the chapter's unlock video(s) plus the same mark-complete flow used
 * in the Training Program. Completing the final lesson invalidates the
 * `moduleAccess` query, which flips the module to unlocked and swaps the real
 * page back in — no manual navigation required.
 */
export default function ModuleUnlockGate({
  moduleLabel,
  chapterId,
}: {
  /** Human-facing name of the module being unlocked, e.g. "Assignments". */
  moduleLabel: string;
  /** The training chapter whose completion unlocks this module. */
  chapterId: string;
}) {
  const { data: training, isLoading } = useMyTraining();

  // The gating chapter lives in the talent's training payload — either inside
  // a course or among the legacy top-level chapters.
  const chapter: TrainingChapter | undefined = (() => {
    if (!training) return undefined;
    for (const course of training.courses) {
      const hit = course.chapters.find((c) => c.id === chapterId);
      if (hit) return hit;
    }
    return training.chapters.find((c) => c.id === chapterId);
  })();

  const available = getAvailableLanguages(chapter);
  const [language, setLanguage] = useState<string>(available[0] ?? 'en');

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  // Defensive fallback: the module is locked but we can't find its chapter (or
  // it has no lessons). Point the user at the Training Program rather than
  // rendering an empty shell.
  if (!chapter || chapter.lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F5F6] text-[#525252]">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
          {moduleLabel} is locked
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#525252]">
          Complete the required training to unlock this section.
        </p>
        <Link
          href="/talent/training"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0a0a0a] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0a0a0a]/85"
        >
          Go to Training Program
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Locked header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-gradient-to-br from-[#FFFAC2]/50 to-white px-6 py-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#0a0a0a] text-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              Unlock {moduleLabel}
            </h1>
            <p className="mt-1 text-sm text-[#525252]">
              Watch the training below and mark each lesson complete to unlock{' '}
              <span className="font-medium text-[#0a0a0a]">{moduleLabel}</span>.
            </p>
          </div>
          {available.length > 1 && (
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="font-[family-name:var(--font-inter)] rounded-lg border border-[#E7E7EA] bg-white px-3 py-1.5 text-[13px] font-medium text-[#0a0a0a] shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/30"
            >
              {available.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang] ?? lang.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Unlock video(s) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {chapter.lessons.map((lesson, idx) => (
          <LessonCard key={lesson.id} lesson={lesson} index={idx} language={language} />
        ))}
      </div>
    </div>
  );
}
