import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

// Knowledge Center — Squad Bot's knowledge, written in SquadHub Resources and
// synced into SquadHire. Read-only here; each item links back to SquadHub.

export interface KnowledgeCategory {
  key: string;
  label: string;
  kind: 'fixed' | 'talent';
  count: number;
}

export interface KnowledgeListItem {
  id: string;
  title: string;
  summary: string | null;
  icon: string | null;
  categories: string[];
  snippet: string;
  synced_at: string;
  edit_url: string;
}

export interface KnowledgeItemDetail extends KnowledgeListItem {
  body_text: string;
}

export interface KnowledgeSuggestion {
  id: string;
  question: string;
  answer: string;
  categories: string[];
  source: string;
  source_ref: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const base = ['admin', 'knowledge'];

export function useKnowledgeCategories() {
  return useQuery<KnowledgeCategory[]>({
    queryKey: [...base, 'categories'],
    queryFn: async () => (await api.get('/admin/knowledge/categories')).data.categories,
  });
}

export function useKnowledgeItems(category: string, q: string) {
  return useQuery<KnowledgeListItem[]>({
    queryKey: [...base, 'items', category, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      return (await api.get(`/admin/knowledge/items?${params.toString()}`)).data.items;
    },
  });
}

export function useKnowledgeItem(id: string | null) {
  return useQuery<KnowledgeItemDetail>({
    queryKey: [...base, 'item', id],
    queryFn: async () => (await api.get(`/admin/knowledge/items/${id}`)).data,
    enabled: !!id,
  });
}

export function useKnowledgeSuggestions() {
  return useQuery<KnowledgeSuggestion[]>({
    queryKey: [...base, 'suggestions', 'pending'],
    queryFn: async () => (await api.get('/admin/knowledge/suggestions?status=pending')).data.suggestions,
  });
}

export interface ApproveInput {
  id: string;
  question: string;
  answer: string;
  categories: string[];
}

/** Approve a Squad Bot draft: saved to SquadHub as knowledge, synced back here. */
export function useApproveSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: ApproveInput) =>
      (await api.post(`/admin/knowledge/suggestions/${id}/approve`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: base }),
  });
}

export function useRejectSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/knowledge/suggestions/${id}/reject`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: base }),
  });
}
