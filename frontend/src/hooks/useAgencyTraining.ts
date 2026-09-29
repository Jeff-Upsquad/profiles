'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import {
  itemToCourse,
  itemToSopSummary,
  type TalentItem,
  type TalentPage,
  type TrainingCourse,
  type TrainingSopSummary,
} from '@/hooks/useTraining';

export interface AgencyTrainingStatus {
  completed: boolean;
  required: Array<{ id: string; title: string; completed: number; total: number }>;
}

export interface AgencyTrainingData {
  courses: TrainingCourse[];
  items: TalentItem[];
  sops: TrainingSopSummary[];
  sopCourses: TrainingCourse[];
  assignments: any[];
  incomplete_count: number;
  status: AgencyTrainingStatus;
}

export interface AgencyWebinar {
  id: string;
  title: string;
  starts_at: string;
  language: string;
  meeting_link: string;
  registered: boolean;
}

export interface AgencyWebinarNotice {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export function useAgencyTraining() {
  return useQuery<AgencyTrainingData>({
    queryKey: ['agencyTraining'],
    queryFn: async () => {
      const { data } = await api.get('/agency/training');
      const items: TalentItem[] = data.items ?? [];
      const coursesRaw: TalentItem[] = data.courses ?? items.filter((i) => i.track !== 'sop');
      const sopsRaw: TalentItem[] = data.sops ?? items.filter((i) => i.track === 'sop');
      return {
        courses: coursesRaw.map(itemToCourse),
        items,
        sops: sopsRaw.map((i) => itemToSopSummary(i, [])),
        sopCourses: sopsRaw.map(itemToCourse),
        assignments: [],
        incomplete_count: data.incomplete_count ?? 0,
        status: data.status ?? { completed: false, required: [] },
      };
    },
    staleTime: 15_000,
  });
}

export function useAgencyTrainingStatus() {
  const query = useAgencyTraining();
  return { ...query, data: query.data?.status };
}

export function useAgencyStartCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data } = await api.post(`/agency/training/courses/${courseId}/start`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencyTraining'] });
    },
  });
}

export function useCompleteAgencyPage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pageId: string) => (await api.post(`/agency/training/pages/${pageId}/complete`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencyTraining'] });
      qc.invalidateQueries({ queryKey: ['agencyTrainingStatus'] });
    },
  });
}

export function useAgencyMarkLessonComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.post(`/agency/training/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencyTraining'] });
      qc.invalidateQueries({ queryKey: ['agencyTrainingStatus'] });
    },
  });
}

export function useAgencyMarkLessonIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.delete(`/agency/training/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencyTraining'] });
      qc.invalidateQueries({ queryKey: ['agencyTrainingStatus'] });
    },
  });
}

export function useAgencyWebinars() {
  return useQuery<AgencyWebinar[]>({
    queryKey: ['agencyWebinars'],
    queryFn: async () => (await api.get('/agency/training/webinars')).data.webinars,
  });
}

export function useAgencyRegisterWebinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/agency/training/webinars/${id}/register`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencyWebinars'] }),
  });
}

export function useAgencyUnregisterWebinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/agency/training/webinars/${id}/register`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencyWebinars'] }),
  });
}

export function useAgencyWebinarAction() {
  const reg = useAgencyRegisterWebinar();
  const unreg = useAgencyUnregisterWebinar();
  return {
    isPending: reg.isPending || unreg.isPending,
    mutateAsync: async ({ id, registered }: { id: string; registered: boolean }) => {
      if (registered) await unreg.mutateAsync(id);
      else await reg.mutateAsync(id);
    },
  };
}

export function useAgencyWebinarLanguages() {
  return useQuery<Array<{ code: string; label: string }>>({
    queryKey: ['agencyWebinarLanguages'],
    queryFn: async () => (await api.get('/agency/training/webinar-languages')).data.languages,
  });
}

export function useAgencyWebinarInterests() {
  return useQuery<string[]>({
    queryKey: ['agencyWebinarInterests'],
    queryFn: async () => (await api.get('/agency/training/webinar-interests')).data.interests,
  });
}

export function useAgencyToggleWebinarInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ language, subscribed }: { language: string; subscribed: boolean }) => {
      if (subscribed) await api.delete(`/agency/training/webinar-interests/${language}`);
      else await api.post('/agency/training/webinar-interests', { language });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencyWebinarInterests'] }),
  });
}

export function useAgencyWebinarInterestAction() {
  return useAgencyToggleWebinarInterest();
}

export function useAgencyTrainingNotifications() {
  return useQuery<AgencyWebinarNotice[]>({
    queryKey: ['agencyTrainingNotifications'],
    queryFn: async () => (await api.get('/agency/training/notifications')).data.notifications,
  });
}

export function flattenAgencyPages(pages: TalentPage[]): TalentPage[] {
  return pages.flatMap((page) => [page, ...flattenAgencyPages(page.children)]);
}
