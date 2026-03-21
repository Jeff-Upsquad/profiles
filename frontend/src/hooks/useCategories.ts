import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { Category, CategoryWithFields } from '@/types';

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/public/categories');
      return data.categories ?? data;
    },
  });
}

export function useCategoryWithFields(slug: string | undefined) {
  return useQuery<CategoryWithFields>({
    queryKey: ['category', slug],
    queryFn: async () => {
      const { data } = await api.get(`/public/categories/${slug}`);
      return data.category ?? data;
    },
    enabled: !!slug,
  });
}
