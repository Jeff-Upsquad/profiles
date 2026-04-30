import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────

export interface TrainingChapter {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  categories: { id: string; name: string; slug: string }[];
  lesson_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingLesson {
  id: string;
  chapter_id: string;
  title: string;
  description?: string;
  loom_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Chapter hooks ─────────────────────────────────────

export function useChapters() {
  return useQuery<TrainingChapter[]>({
    queryKey: ['admin', 'training', 'chapters'],
    queryFn: async () => {
      const { data } = await api.get('/admin/training/chapters');
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
      category_ids: string[];
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
      loom_url: string;
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
      loom_url?: string;
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
