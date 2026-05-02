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

export function pickLessonUrl(lesson: TrainingLesson, language: string): string {
  const videos = lesson.videos ?? [];
  const match = videos.find((v) => v.language === language);
  if (match) return match.loom_url;
  const en = videos.find((v) => v.language === 'en');
  if (en) return en.loom_url;
  if (videos[0]) return videos[0].loom_url;
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
 * Falls back to ['en'] if no per-language video variants exist.
 */
export function getCourseLanguages(course: TrainingCourse | null | undefined): string[] {
  if (!course) return ['en'];
  const langs = new Set<string>();
  for (const ch of course.chapters ?? []) {
    for (const lesson of ch.lessons ?? []) {
      for (const v of lesson.videos ?? []) {
        langs.add(v.language);
      }
    }
  }
  if (langs.size === 0) langs.add('en');
  return Array.from(langs);
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
    },
  });
}

// ---------------------------------------------------------------------------
// Module access
// ---------------------------------------------------------------------------

interface LockedModule {
  module: string;
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
