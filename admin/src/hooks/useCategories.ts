import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryField {
  id: string;
  category_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  placeholder?: string;
  helper_text?: string;
  sort_order: number;
  validation_rules?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FieldOption {
  id: string;
  field_id: string;
  label: string;
  value: string;
  sort_order: number;
}

// ── Category hooks ─────────────────────────────────────

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data.categories || data;
    },
  });
}

export interface TemplateItem {
  id: string;
  name: string;
  /** Optional grouping label (e.g. "Designer" / "Editor"). */
  group?: string | null;
  sort_order?: number;
}

function uniq<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Fetches the per-category template categories/skills/tools/AI-tools and
 * exposes a name → group lookup for each. Categories whose templates carry
 * no group value return empty maps, so callers fall back to flat rendering.
 *
 * Mirrors the public/business profile hook so the admin preview renders the
 * same grouped skill sections as the live profile.
 */
export function useCategoryTemplateGroups(categoryId: string | undefined) {
  const categoriesQ = useQuery<TemplateItem[]>({
    queryKey: ['templateCategories', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/portfolio-categories`);
      return data.portfolio_categories ?? data;
    },
    enabled: !!categoryId,
  });

  const skillsQ = useQuery<TemplateItem[]>({
    queryKey: ['templateSkills', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/skills`);
      return data.skills ?? data;
    },
    enabled: !!categoryId,
  });

  const toolsQ = useQuery<TemplateItem[]>({
    queryKey: ['templateTools', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/tools`);
      return data.tools ?? data;
    },
    enabled: !!categoryId,
  });

  const aiToolsQ = useQuery<TemplateItem[]>({
    queryKey: ['templateAiTools', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${categoryId}/ai-tools`);
      return data.ai_tools ?? data;
    },
    enabled: !!categoryId,
  });

  const categories = categoriesQ.data ?? [];
  const skills = skillsQ.data ?? [];
  const tools = toolsQ.data ?? [];
  const aiTools = aiToolsQ.data ?? [];

  const skillGroups = useMemo(
    () => Object.fromEntries(skills.map((s) => [s.name, s.group ?? null])) as Record<string, string | null>,
    [skills]
  );
  const toolGroups = useMemo(
    () => Object.fromEntries(tools.map((t) => [t.name, t.group ?? null])) as Record<string, string | null>,
    [tools]
  );
  const aiToolGroups = useMemo(
    () => Object.fromEntries(aiTools.map((a) => [a.name, a.group ?? null])) as Record<string, string | null>,
    [aiTools]
  );

  // Group order = order of first occurrence in the templates (already sorted
  // server-side by sort_order, with Designer rows before Editor).
  const skillGroupOrder = useMemo(() => uniq(skills.map((s) => s.group || '')), [skills]);

  const isLoading =
    !!categoryId &&
    (categoriesQ.isLoading || skillsQ.isLoading || toolsQ.isLoading || aiToolsQ.isLoading);

  return {
    categories,
    skills,
    tools,
    aiTools,
    skillGroups,
    toolGroups,
    aiToolGroups,
    skillGroupOrder,
    isLoading,
  };
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Category>) => {
      const { data } = await api.post('/admin/categories', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create category');
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Category> & { id: string }) => {
      const { data } = await api.put(`/admin/categories/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update category');
    },
  });
}

export function useArchiveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/admin/categories/${id}/archive`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      toast.success('Category status updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update category');
    },
  });
}

// ── Field hooks ────────────────────────────────────────

export function useCategoryFields(categoryId: string | undefined) {
  return useQuery<CategoryField[]>({
    queryKey: ['admin', 'categories', categoryId, 'fields'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${categoryId}/fields`);
      return data.fields || data;
    },
    enabled: !!categoryId,
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CategoryField> & { category_id: string }) => {
      const { data } = await api.post(
        `/admin/categories/${payload.category_id}/fields`,
        payload,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'categories', variables.category_id, 'fields'],
      });
      toast.success('Field created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create field');
    },
  });
}

export function useUpdateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      category_id,
      ...payload
    }: Partial<CategoryField> & { id: string; category_id: string }) => {
      const { data } = await api.put(`/admin/fields/${id}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'categories', variables.category_id, 'fields'],
      });
      toast.success('Field updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update field');
    },
  });
}

export function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, category_id }: { id: string; category_id: string }) => {
      await api.delete(`/admin/fields/${id}`);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'categories', variables.category_id, 'fields'],
      });
      toast.success('Field deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete field');
    },
  });
}

// ── Field Option hooks ─────────────────────────────────

export function useFieldOptions(fieldId: string | undefined) {
  return useQuery<FieldOption[]>({
    queryKey: ['admin', 'fields', fieldId, 'options'],
    queryFn: async () => {
      const { data } = await api.get(`/admin/fields/${fieldId}/options`);
      return data.options || data;
    },
    enabled: !!fieldId,
  });
}

export function useCreateOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FieldOption> & { field_id: string }) => {
      const { data } = await api.post(
        `/admin/fields/${payload.field_id}/options`,
        payload,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'fields', variables.field_id, 'options'],
      });
      toast.success('Option added');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to add option');
    },
  });
}

export function useUpdateOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      field_id,
      ...payload
    }: Partial<FieldOption> & { id: string; field_id: string }) => {
      const { data } = await api.put(`/admin/options/${id}`, payload);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'fields', variables.field_id, 'options'],
      });
      toast.success('Option updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update option');
    },
  });
}

export function useDeleteOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field_id }: { id: string; field_id: string }) => {
      await api.delete(`/admin/options/${id}`);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['admin', 'fields', variables.field_id, 'options'],
      });
      toast.success('Option deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to delete option');
    },
  });
}
