import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

/**
 * Training admin.
 *
 * Content — titles, pages, blocks, videos, quizzes — is authored in SquadHub's
 * Resources module and synced down, so there are no create/edit hooks for it
 * here. What this file covers is the configuration SquadHire owns: publication,
 * job-profile targeting, the countdown, sharing, and the two locks.
 */

// ── Types ──────────────────────────────────────────────

export interface TrainingItem {
  id: string;
  kind: 'course' | 'post';
  track: 'learning' | 'sop';
  title: string;
  summary?: string | null;
  icon?: string | null;
  cover_image_url?: string | null;
  status: 'draft' | 'published' | 'archived';
  sort_order: number;
  is_active: boolean;
  is_onboarding: boolean;
  available_to_all: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  deleted_at?: string | null;
  categories: { id: string; name: string; slug: string }[];
  category_ids: string[];
  page_count?: number;
  /** Where to go to edit this content. */
  squadhub_url: string;
  /** Null until SquadHub has published this item down to us. */
  squadhub_item_id: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

/** One node of an item's page tree, as the gating screen sees it. */
export interface TrainingPageNode {
  id: string;
  item_id: string;
  parent_page_id: string | null;
  title: string;
  icon?: string | null;
  position: number;
  is_active: boolean;
  linked_module?: string | null;
  gates_profile_creation: boolean;
  language: string;
  /** False for a container page (a heading with no content of its own). */
  has_content: boolean;
}

/** The talent-portal modules a page can gate. */
export const LINKED_MODULES = [
  { value: 'basic-profile', label: 'Basic profile' },
  { value: 'profiles', label: 'Job profiles' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'settings', label: 'Settings' },
  { value: 'notifications', label: 'Notifications' },
] as const;

// ── Item hooks ─────────────────────────────────────────

const itemsKey = ['admin', 'training', 'courses'];

export function useCourses() {
  return useQuery<TrainingItem[]>({
    queryKey: itemsKey,
    queryFn: async () => {
      const { data } = await api.get('/admin/training/courses');
      return data;
    },
  });
}

export function useArchivedCourses() {
  return useQuery<TrainingItem[]>({
    queryKey: [...itemsKey, 'archived'],
    queryFn: async () => {
      const { data } = await api.get('/admin/training/courses/archived');
      return data;
    },
  });
}

export function useCourse(id: string | undefined) {
  return useQuery<TrainingItem>({
    queryKey: [...itemsKey, id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/courses/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export interface UpdateItemPayload {
  is_active?: boolean;
  is_onboarding?: boolean;
  available_to_all?: boolean;
  countdown_enabled?: boolean;
  countdown_hours?: number | null;
  sort_order?: number;
  status?: 'draft' | 'published' | 'archived';
  category_ids?: string[];
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateItemPayload & { id: string }) => {
      const { data } = await api.put(`/admin/training/courses/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemsKey });
      toast.success('Course settings saved');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to save'),
  });
}

/**
 * Point a course at the SquadHub item that should author it (or unlink it with
 * null). Courses that predate the sync have no link, which is what leaves them
 * uneditable; linking lets the next publish from SquadHub land on the pages
 * talents are already working through.
 */
export function useLinkCourseToSquadhub(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (squadhubItemId: string | null) => {
      const { data } = await api.put(`/admin/training/courses/${id}/squadhub-link`, {
        squadhub_item_id: squadhubItemId,
      });
      return data;
    },
    onSuccess: (_data, squadhubItemId) => {
      qc.invalidateQueries({ queryKey: itemsKey });
      toast.success(squadhubItemId ? 'Linked to SquadHub' : 'Link removed');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to link'),
  });
}

export function useArchiveCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/training/courses/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemsKey });
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
      qc.invalidateQueries({ queryKey: itemsKey });
      toast.success('Course restored');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to restore course'),
  });
}

// ── Page gating ────────────────────────────────────────

export function useItemPages(itemId: string | undefined) {
  return useQuery<TrainingPageNode[]>({
    queryKey: [...itemsKey, itemId, 'pages'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/courses/${itemId}/pages`);
      return data;
    },
    enabled: !!itemId,
  });
}

export interface UpdatePageConfigPayload {
  linked_module?: string | null;
  gates_profile_creation?: boolean;
  language?: string;
  is_active?: boolean;
}

export function useUpdatePageConfig(itemId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, ...payload }: UpdatePageConfigPayload & { pageId: string }) => {
      const { data } = await api.put(`/admin/training/pages/${pageId}/config`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...itemsKey, itemId, 'pages'] });
      toast.success('Lock settings saved');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Failed to save'),
  });
}

// ── Share / assignments ───────────────────────────────

export interface CourseShareStats {
  assigned: number;
  completed: number;
  in_progress: number;
  not_started: number;
}

export function useCourseShareStats(courseId: string | undefined) {
  return useQuery<CourseShareStats>({
    queryKey: [...itemsKey, courseId, 'share-stats'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/courses/${courseId}/share-stats`);
      return data;
    },
    enabled: !!courseId,
  });
}

export function usePreviewShareAudience() {
  return useMutation({
    mutationFn: async (payload: { available_to_all?: boolean; category_ids?: string[] }) => {
      const { data } = await api.post<{ count: number }>('/admin/training/share/preview', payload);
      return data;
    },
  });
}

export function useShareCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      courseId,
      ...payload
    }: {
      courseId: string;
      available_to_all?: boolean;
      category_ids?: string[];
      notify?: boolean;
      reack?: boolean;
      title?: string;
      body?: string;
    }) => {
      const { data } = await api.post<{
        recipient_count: number;
        notified: number;
        reopened: number;
      }>(`/admin/training/courses/${courseId}/share`, payload);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...itemsKey, vars.courseId, 'share-stats'] });
      toast.success('Course shared with talents');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to share course'),
  });
}
