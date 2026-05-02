import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────

export interface TrainingCourse {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  is_onboarding: boolean;
  available_to_all: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  deleted_at?: string | null;
  categories: { id: string; name: string; slug: string }[];
  chapter_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingChapter {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  is_onboarding: boolean;
  language: string;
  linked_module?: string | null;
  course_id?: string | null;
  categories: { id: string; name: string; slug: string }[];
  lesson_count: number;
  created_at: string;
  updated_at: string;
}

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Course hooks ──────────────────────────────────────

export function useCourses() {
  return useQuery<TrainingCourse[]>({
    queryKey: ['admin', 'training', 'courses'],
    queryFn: async () => {
      const { data } = await api.get('/admin/training/courses');
      return data;
    },
  });
}

export function useArchivedCourses() {
  return useQuery<TrainingCourse[]>({
    queryKey: ['admin', 'training', 'courses', 'archived'],
    queryFn: async () => {
      const { data } = await api.get('/admin/training/courses/archived');
      return data;
    },
  });
}

export function useCourse(id: string | undefined) {
  return useQuery<TrainingCourse>({
    queryKey: ['admin', 'training', 'courses', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/courses/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

interface CourseMutationPayload {
  title: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
  is_onboarding?: boolean;
  available_to_all?: boolean;
  countdown_enabled?: boolean;
  countdown_hours?: number | null;
  category_ids?: string[];
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CourseMutationPayload) => {
      const { data } = await api.post('/admin/training/courses', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'courses'] });
      toast.success('Course created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create course'),
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<CourseMutationPayload>) => {
      const { data } = await api.put(`/admin/training/courses/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'courses'] });
      toast.success('Course updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update course'),
  });
}

export function useArchiveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/training/courses/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'courses'] });
      toast.success('Course archived');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to archive course'),
  });
}

export function useRestoreCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/training/courses/${id}/restore`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'courses'] });
      toast.success('Course restored');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to restore course'),
  });
}

// ── Chapter hooks ─────────────────────────────────────

export function useChapters(courseId?: string | null) {
  return useQuery<TrainingChapter[]>({
    queryKey: ['admin', 'training', 'chapters', { courseId }],
    queryFn: async () => {
      const params = courseId === undefined ? {} : { course_id: courseId === null ? 'null' : courseId };
      const { data } = await api.get('/admin/training/chapters', { params });
      return data;
    },
  });
}

export function useChapter(id: string | undefined) {
  return useQuery<TrainingChapter>({
    queryKey: ['admin', 'training', 'chapters', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/chapters/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description?: string;
      sort_order?: number;
      is_active?: boolean;
      is_onboarding?: boolean;
      language?: string;
      linked_module?: string | null;
      course_id?: string | null;
      category_ids?: string[];
    }) => {
      const { data } = await api.post('/admin/training/chapters', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'chapters'] });
      toast.success('Chapter created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create chapter');
    },
  });
}

export function useUpdateChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      title?: string;
      description?: string;
      sort_order?: number;
      is_active?: boolean;
      is_onboarding?: boolean;
      language?: string;
      linked_module?: string | null;
      course_id?: string | null;
      category_ids?: string[];
    }) => {
      const { data } = await api.put(`/admin/training/chapters/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'chapters'] });
      toast.success('Chapter updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update chapter');
    },
  });
}

export function useDeleteChapter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/training/chapters/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'chapters'] });
      toast.success('Chapter deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete chapter');
    },
  });
}

// ── Lesson hooks ──────────────────────────────────────

export function useLessons(chapterId: string | undefined) {
  return useQuery<TrainingLesson[]>({
    queryKey: ['admin', 'training', 'chapters', chapterId, 'lessons'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/chapters/${chapterId}/lessons`);
      return data;
    },
    enabled: !!chapterId,
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      chapterId,
      ...payload
    }: {
      chapterId: string;
      title: string;
      description?: string;
      videos: LessonVideo[];
      sort_order?: number;
      is_active?: boolean;
    }) => {
      const { data } = await api.post(`/admin/training/chapters/${chapterId}/lessons`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'training', 'chapters', variables.chapterId, 'lessons'],
      });
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'chapters'] });
      toast.success('Lesson created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create lesson');
    },
  });
}

export function useUpdateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lessonId,
      chapterId,
      ...payload
    }: {
      lessonId: string;
      chapterId: string;
      title?: string;
      description?: string;
      videos?: LessonVideo[];
      sort_order?: number;
      is_active?: boolean;
    }) => {
      const { data } = await api.put(`/admin/training/lessons/${lessonId}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'training', 'chapters', variables.chapterId, 'lessons'],
      });
      toast.success('Lesson updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update lesson');
    },
  });
}

export function useDeleteLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lessonId, chapterId }: { lessonId: string; chapterId: string }) => {
      await api.delete(`/admin/training/lessons/${lessonId}`);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'training', 'chapters', variables.chapterId, 'lessons'],
      });
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'chapters'] });
      toast.success('Lesson deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete lesson');
    },
  });
}
