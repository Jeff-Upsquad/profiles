import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

export interface TrainingSop {
  id: string;
  title: string;
  summary?: string | null;
  icon?: string | null;
  cover_image_url?: string | null;
  status: 'draft' | 'published' | 'archived';
  available_to_all: boolean;
  sort_order: number;
  published_at?: string | null;
  categories: { id: string; name: string; slug: string }[];
  created_at: string;
  updated_at: string;
}

export interface SopPage {
  id: string;
  sop_id: string;
  parent_page_id: string | null;
  title: string;
  icon?: string | null;
  position: number;
  is_active: boolean;
}

export interface SopBlock {
  id: string;
  page_id: string;
  type: 'text' | 'image' | 'video_embed' | 'pdf';
  position: number;
  text_content?: unknown;
  file_url?: string | null;
  file_name?: string | null;
  embed_url?: string | null;
  embed_provider?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown>;
}

export function useSops() {
  return useQuery<TrainingSop[]>({
    queryKey: ['admin', 'training', 'sops'],
    queryFn: async () => {
      const { data } = await api.get('/admin/training/sops');
      return data;
    },
  });
}

export function useSop(id: string | undefined) {
  return useQuery<TrainingSop>({
    queryKey: ['admin', 'training', 'sops', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/sops/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TrainingSop> & { title: string; category_ids?: string[] }) => {
      const { data } = await api.post('/admin/training/sops', payload);
      return data as TrainingSop;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops'] });
      toast.success('SOP created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create SOP'),
  });
}

export function useUpdateSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Record<string, unknown>) => {
      const { data } = await api.put(`/admin/training/sops/${id}`, payload);
      return data as TrainingSop;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops'] });
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops', vars.id] });
      toast.success('SOP updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update SOP'),
  });
}

export function useArchiveSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/training/sops/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops'] });
      toast.success('SOP archived');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to archive SOP'),
  });
}

export function useSopPages(sopId: string | undefined) {
  return useQuery<SopPage[]>({
    queryKey: ['admin', 'training', 'sops', sopId, 'pages'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/sops/${sopId}/pages`);
      return data;
    },
    enabled: !!sopId,
  });
}

export function useCreateSopPage(sopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; parent_page_id?: string | null }) => {
      const { data } = await api.post(`/admin/training/sops/${sopId}/pages`, payload);
      return data as SopPage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops', sopId, 'pages'] });
      toast.success('Page added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add page'),
  });
}

export function useUpdateSopPage(sopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, ...payload }: { pageId: string } & Record<string, unknown>) => {
      const { data } = await api.put(`/admin/training/sop-pages/${pageId}`, payload);
      return data as SopPage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops', sopId, 'pages'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update page'),
  });
}

export function useDeleteSopPage(sopId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pageId: string) => {
      await api.delete(`/admin/training/sop-pages/${pageId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops', sopId, 'pages'] });
      toast.success('Page deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete page'),
  });
}

export function useSopPageBlocks(pageId: string | undefined) {
  return useQuery<SopBlock[]>({
    queryKey: ['admin', 'training', 'sop-pages', pageId, 'blocks'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/sop-pages/${pageId}/blocks`);
      return data;
    },
    enabled: !!pageId,
  });
}

export function useCreateSopBlock(pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<SopBlock> & { type: SopBlock['type'] }) => {
      const { data } = await api.post(`/admin/training/sop-pages/${pageId}/blocks`, payload);
      return data as SopBlock;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sop-pages', pageId, 'blocks'] });
      toast.success('Block added');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to add block'),
  });
}

export function useUpdateSopBlock(pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId, ...payload }: { blockId: string } & Record<string, unknown>) => {
      const { data } = await api.put(`/admin/training/sop-blocks/${blockId}`, payload);
      return data as SopBlock;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sop-pages', pageId, 'blocks'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update block'),
  });
}

export function useDeleteSopBlock(pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (blockId: string) => {
      await api.delete(`/admin/training/sop-blocks/${blockId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sop-pages', pageId, 'blocks'] });
      toast.success('Block deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete block'),
  });
}

export function useShareSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      sopId,
      ...payload
    }: {
      sopId: string;
      available_to_all?: boolean;
      category_ids?: string[];
      notify?: boolean;
      reack?: boolean;
      title?: string;
      body?: string;
    }) => {
      const { data } = await api.post(`/admin/training/sops/${sopId}/share`, payload);
      return data as { recipient_count: number; notified: number; reopened: number };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'training', 'sops', vars.sopId] });
      toast.success('SOP shared with talents');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to share SOP'),
  });
}

export function useSopShareStats(sopId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'training', 'sops', sopId, 'share-stats'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/sops/${sopId}/share-stats`);
      return data as {
        assigned: number;
        completed: number;
        in_progress: number;
        not_started: number;
      };
    },
    enabled: !!sopId,
  });
}
