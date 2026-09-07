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

/**
 * Categories the logged-in talent is allowed to create a profile in.
 *
 * Distinct from `useCategories()`: this endpoint hides the Designer + Editor
 * combined category (now ghost-only — auto-generated when a talent has both
 * a Designer and a Video Editor profile). Use this hook in talent-side
 * pickers; everywhere else (home page, business discovery) continues to use
 * `useCategories()`.
 */
export function useTalentCreatableCategories() {
  return useQuery<Category[]>({
    queryKey: ['talentCreatableCategories'],
    queryFn: async () => {
      const { data } = await api.get('/talent/profile-categories');
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

export interface TemplateItem {
  id: string;
  name: string;
  group?: string | null;
  sort_order?: number;
}

/**
 * Maps a connect-brief service-type slug to the talent category slug whose
 * template tables (categories / skill sets / tools / AI tools) back both the
 * job-profile form and the brief form. Unknown future roles fall back to
 * replacing underscores with hyphens (`ads_specialist` → `ads-specialist`).
 */
export function categorySlugForRole(roleSlug: string): string {
  const explicit: Record<string, string> = {
    designer: 'designer',
    video_editor: 'video-editor',
    designer_video_editor: 'designer-editor',
    accountant: 'accountant',
    ads_specialist: 'ads-specialist',
  };
  return explicit[roleSlug] ?? roleSlug.replace(/_/g, '-');
}

/**
 * Fetches the per-category template categories/skills/tools/AI-tools and
 * exposes a name → group lookup for each. Categories whose templates carry
 * no group value return empty maps, so callers can fall back to flat rendering.
 *
 * Shared by the talent job-profile form and the business brief form so a
 * catalog change in admin appears in both.
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
  // server-side by sort_order, with Designer rows before Editor for the
  // Designer + Editor category).
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

/**
 * Resolves a brief-form role slug to the matching talent category, then loads
 * that category's template catalog. Used by the connect-brief additional-
 * requirements picker so it stays in lockstep with job-profile creation.
 */
export function useRoleTemplateCatalog(roleSlug: string) {
  const { data: allCategories = [], isLoading: categoriesLoading } = useCategories();
  const categorySlug = categorySlugForRole(roleSlug);
  const category = allCategories.find((c) => c.slug === categorySlug);
  const templates = useCategoryTemplateGroups(category?.id);

  return {
    category,
    ...templates,
    isLoading: categoriesLoading || (!!category && templates.isLoading),
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
