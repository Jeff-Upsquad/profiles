import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

/**
 * Rich content blocks on a training lesson (`training_lesson_blocks`) — the
 * same content model SOP pages use, so a course lesson can be a full document
 * instead of just a video.
 */
export type LessonBlockType =
  | 'text'
  | 'image'
  | 'video_upload'
  | 'video_embed'
  | 'audio'
  | 'pdf';

export interface LessonBlock {
  id: string;
  lesson_id: string;
  type: LessonBlockType;
  position: number;
  text_content?: unknown;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  embed_url?: string | null;
  embed_provider?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown>;
}

export type LessonBlockInput = Partial<Omit<LessonBlock, 'id' | 'lesson_id'>> & {
  type: LessonBlockType;
};

const blocksKey = (lessonId: string) => ['admin', 'training', 'lessons', lessonId, 'blocks'];

export function useLessonBlocks(lessonId: string | undefined) {
  return useQuery<LessonBlock[]>({
    queryKey: blocksKey(lessonId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/lessons/${lessonId}/blocks`);
      return data;
    },
    enabled: !!lessonId,
  });
}

export function useCreateLessonBlock(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LessonBlockInput) => {
      const { data } = await api.post(`/admin/training/lessons/${lessonId}/blocks`, payload);
      return data as LessonBlock;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(lessonId) }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add block'),
  });
}

export function useUpdateLessonBlock(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId, ...payload }: { blockId: string } & Partial<LessonBlockInput>) => {
      const { data } = await api.put(`/admin/training/lesson-blocks/${blockId}`, payload);
      return data as LessonBlock;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(lessonId) }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save block'),
  });
}

export function useDeleteLessonBlock(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blockId: string) => {
      await api.delete(`/admin/training/lesson-blocks/${blockId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(lessonId) }),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete block'),
  });
}

export function useReorderLessonBlocks(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; position: number }[]) => {
      await api.patch(`/admin/training/lessons/${lessonId}/blocks/reorder`, { items });
    },
    // The caller writes the new order into the cache optimistically, so only
    // refetch once the server has confirmed it.
    onSuccess: () => qc.invalidateQueries({ queryKey: blocksKey(lessonId) }),
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reorder blocks');
      qc.invalidateQueries({ queryKey: blocksKey(lessonId) });
    },
  });
}
