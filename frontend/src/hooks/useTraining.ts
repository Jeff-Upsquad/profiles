import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

export interface LessonVideo {
  language: string;
  loom_url: string;
}

export interface TrainingLesson {
  id: string;
  chapter_id: string;
  title: string;
  description?: string;
  loom_url: string;
  videos: LessonVideo[];
  sort_order: number;
  completed: boolean;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
};

/**
 * Strict resolver — returns the URL for the exact selected language.
 * Falls back ONLY to the legacy `loom_url` field if no language variant
 * matches (e.g., a lesson with no per-language videos at all). Does NOT
 * silently substitute a different language.
 *
 * The course-level language picker is built from the intersection of
 * languages available across every lesson, so in practice the selected
 * language will always be present.
 */
export function pickLessonUrl(lesson: TrainingLesson, language: string): string {
  const videos = lesson.videos ?? [];
  const match = videos.find((v) => v.language === language);
  if (match) return match.loom_url;
  // Legacy fallback only — no language is silently substituted.
  return lesson.loom_url ?? '';
}

export function getAvailableLanguages(chapters: TrainingChapter[] | TrainingChapter | null | undefined): string[] {
  if (!chapters) return ['en'];
  const list = Array.isArray(chapters) ? chapters : [chapters];
  const langs = new Set<string>();
  for (const ch of list) {
    for (const lesson of ch.lessons ?? []) {
      for (const v of lesson.videos ?? []) {
        langs.add(v.language);
      }
    }
  }
  if (langs.size === 0) langs.add('en');
  return Array.from(langs);
}

export interface TrainingChapter {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  lessons: TrainingLesson[];
  completed_count: number;
  total_count: number;
  /** Computed by the API for onboarding courses; absent on legacy chapters */
  unlocked?: boolean;
  linked_module?: string | null;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  is_onboarding: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  started_at: string | null;
  expires_at: string | null;
  expired: boolean;
  categories: { id: string; name: string; slug: string }[];
  chapters: TrainingChapter[];
  completed_count: number;
  total_count: number;
}

export interface MyTrainingResponse {
  courses: TrainingCourse[];
  /** Legacy chapters not yet assigned to a course */
  chapters: TrainingChapter[];
}

export function useMyTraining() {
  return useQuery<MyTrainingResponse>({
    queryKey: ['myTraining'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training');
      return {
        courses: data.courses ?? [],
        chapters: data.chapters ?? [],
      };
    },
  });
}

/**
 * Convenience: just the courses (sorted as returned by the server).
 */
export function useMyCourses() {
  const query = useMyTraining();
  return { ...query, data: query.data?.courses ?? [] };
}

export function useOnboardingCourses() {
  return useQuery<TrainingCourse[]>({
    queryKey: ['onboardingCourses'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/onboarding-courses');
      return data.courses ?? [];
    },
  });
}

export function useCourse(courseId: string | undefined) {
  const query = useMyTraining();
  const course = query.data?.courses.find((c) => c.id === courseId) ?? null;
  return { ...query, data: course };
}

/**
 * Compute the languages available across every lesson in the course.
 *
 * Returns the INTERSECTION — only languages that EVERY lesson supports.
 * This guarantees that selecting a language at the course level plays
 * that exact language for all lessons, with no silent fallback.
 *
 * Lessons without any video variants are skipped from the intersection
 * calc (they fall back to the legacy `loom_url` field). If the
 * intersection is empty (no language is in every lesson), returns ['en']
 * so the player still has a default; in that case the picker is hidden
 * and lessons play their legacy `loom_url`.
 */
export function getCourseLanguages(course: TrainingCourse | null | undefined): string[] {
  if (!course) return ['en'];
  let intersection: Set<string> | null = null;
  for (const ch of course.chapters ?? []) {
    for (const lesson of ch.lessons ?? []) {
      const lessonLangs = new Set((lesson.videos ?? []).map((v) => v.language));
      if (lessonLangs.size === 0) continue; // skip lessons with no variants
      if (intersection === null) {
        intersection = lessonLangs;
      } else {
        const prev: Set<string> = intersection;
        intersection = new Set(Array.from(prev).filter((l) => lessonLangs.has(l)));
      }
    }
  }
  if (!intersection || intersection.size === 0) return ['en'];
  return Array.from(intersection);
}

/** localStorage helpers for per-course language selection */
export function getStoredCourseLanguage(courseId: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(`training_language:${courseId}`);
}

export function setStoredCourseLanguage(courseId: string, language: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`training_language:${courseId}`, language);
}

// ---------------------------------------------------------------------------
// Course countdown helpers
// ---------------------------------------------------------------------------

/**
 * Format the time remaining until `expiresAt` as a short human string.
 * "2d 4h" / "3h 12m" / "12m" / "Overdue".
 */
export function formatRemaining(expiresAt: string | null | undefined, now: Date = new Date()): string {
  if (!expiresAt) return '';
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  if (diffMs <= 0) return 'Overdue';
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Format the duration the admin set, for display in the popup body.
 * Reads countdown_hours and prefers days when divisible by 24.
 */
export function formatDuration(hours: number | null | undefined): string {
  if (!hours || hours <= 0) return '';
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '1 day' : `${days} days`;
  }
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/**
 * Filter courses whose deadline is currently active for this user
 * (countdown enabled, started, and not yet expired).
 */
export function getActiveCountdowns(courses: TrainingCourse[] | undefined | null): TrainingCourse[] {
  if (!courses) return [];
  return courses.filter((c) => c.countdown_enabled && c.started_at && !c.expired);
}

export function useStartCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data } = await api.post(`/talent/training/courses/${courseId}/start`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
    },
  });
}

export function useRequestCourseReopen() {
  return useMutation({
    mutationFn: async ({ courseId, reason }: { courseId: string; reason?: string }) => {
      const { data } = await api.post(`/talent/training/courses/${courseId}/request-reopen`, {
        reason,
      });
      return data as { message: string; requestId: string; already: boolean };
    },
  });
}

/** Re-renders every `intervalMs` so countdown displays stay live. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMarkLessonComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.post(`/talent/training/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
      qc.invalidateQueries({ queryKey: ['moduleAccess'] });
      qc.invalidateQueries({ queryKey: ['profileGate'] });
    },
  });
}

export function useMarkLessonIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.delete(`/talent/training/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
      qc.invalidateQueries({ queryKey: ['moduleAccess'] });
      qc.invalidateQueries({ queryKey: ['profileGate'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Module access
// ---------------------------------------------------------------------------

interface LockedModule {
  module: string;
  chapter_id: string;
  chapter_title: string;
  completed: number;
  total: number;
}

interface ModuleAccess {
  unlocked: string[];
  locked: LockedModule[];
}

export function useModuleAccess() {
  return useQuery<ModuleAccess>({
    queryKey: ['moduleAccess'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/module-access');
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Profile-creation gate (per category)
// ---------------------------------------------------------------------------

export interface ProfileGate {
  /** True when the talent must finish `chapter` before building this profile. */
  locked: boolean;
  /** The gate chapter to render (lessons/videos/completion), or null when the
   *  category has no profile-gate lesson (opt-in — build immediately). */
  chapter: TrainingChapter | null;
}

/**
 * Whether the talent must complete a training chapter before creating a job
 * profile in `categoryId`. Returns `locked: false` when the category has no
 * gate lesson or the lessons are already done.
 */
export function useProfileGate(categoryId: string | undefined) {
  return useQuery<ProfileGate>({
    queryKey: ['profileGate', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await api.get(`/talent/training/profile-gate/${categoryId}`);
      return { locked: !!data.locked, chapter: data.chapter ?? null };
    },
  });
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export function useOnboardingTraining() {
  return useQuery<TrainingChapter | null>({
    queryKey: ['onboardingTraining'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/onboarding');
      return data.chapter ?? null;
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  const { refetchUser } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/talent/training/complete-onboarding');
      return data;
    },
    onSuccess: async () => {
      await refetchUser();
      qc.invalidateQueries({ queryKey: ['onboardingTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
      qc.invalidateQueries({ queryKey: ['myTraining'] });
    },
  });
}
