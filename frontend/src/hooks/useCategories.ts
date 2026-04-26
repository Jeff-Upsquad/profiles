import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
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

interface TemplateItem {
  id: string;
  name: string;
  group?: string | null;
  sort_order?: number;
}

/**
 * Fetches the per-category template skills/tools/AI-tools and exposes a
 * name → group lookup for each. Categories whose templates carry no group
 * value return empty maps, so callers can fall back to flat rendering.
 *
 * Uses the same query keys as `DesignerExtras` so cache is shared.
 */
export function useCategoryTemplateGroups(categoryId: string | undefined) {
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
  // server-side by sort_order, with Designer rows before Editor for the
  // Designer + Editor category).
  const skillGroupOrder = useMemo(() => uniq(skills.map((s) => s.group || '')), [skills]);

  return {
    skills,
    tools,
    aiTools,
    skillGroups,
    toolGroups,
    aiToolGroups,
    skillGroupOrder,
  };
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
