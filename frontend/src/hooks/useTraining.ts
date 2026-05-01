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
}

export function useMyTraining() {
  return useQuery<TrainingChapter[]>({
    queryKey: ['myTraining'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training');
      return data.chapters ?? data;
    },
  });
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
    },
  });
}
