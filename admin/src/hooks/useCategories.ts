import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
