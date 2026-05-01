import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

export interface TrainingLesson {
  id: string;
  chapter_id: string;
  title: string;
  description?: string;
  loom_url: string;
  sort_order: number;
  completed: boolean;
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
