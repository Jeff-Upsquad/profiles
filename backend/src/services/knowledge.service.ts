// ---------------------------------------------------------------------------
// Knowledge Center — what Squad Bot knows.
//
// Written in SquadHub Resources (track 'knowledge') and pushed here on every
// publish / edit / unpublish, the same signed channel training uses. SquadHub
// owns the words; this module keeps the searchable copy, flattens each item to
// plain text for the bot, and serves the admin Knowledge Center.
//
// Categories are keys: 'general', 'tech', or a talent category slug. The talent
// ones come live from `categories`, so a new category needs no code change.
// ---------------------------------------------------------------------------

import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { SyncPage } from './training-sync.service.js';
import { flattenPages } from '../lib/knowledge-text.js';

export interface KnowledgeCategory {
  key: string;
  label: string;
  /** 'fixed' = General / Tech & App Help; 'talent' = a talent category. */
  kind: 'fixed' | 'talent';
}

const FIXED_CATEGORIES: KnowledgeCategory[] = [
  { key: 'general', label: 'General', kind: 'fixed' },
  { key: 'tech', label: 'Tech & App Help', kind: 'fixed' },
];

export async function listKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('name, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new AppError(500, `Failed to load categories: ${error.message}`);
  const talent = (data ?? []).map((c: { name: string; slug: string }) => ({
    key: c.slug,
    label: c.name.trim(),
    kind: 'talent' as const,
  }));
  return [...FIXED_CATEGORIES, ...talent];
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export interface KnowledgeSyncPayload {
  id: string;
  title: string;
  summary?: string | null;
  icon?: string | null;
  knowledge_categories: string[];
  /** False when the item was unpublished or deleted in SquadHub. */
  visible: boolean;
  pages: SyncPage[];
}

export async function syncKnowledgeItem(payload: KnowledgeSyncPayload) {
  if (!payload?.id) throw new AppError(400, 'Missing item id');

  if (!payload.visible) {
    const { error } = await supabaseAdmin.from('knowledge_items').delete().eq('squadhub_item_id', payload.id);
    if (error) throw new AppError(500, `Failed to remove knowledge item: ${error.message}`);
    return { removed: true };
  }

  const known = new Set((await listKnowledgeCategories()).map((c) => c.key));
  // Unknown keys (a category deactivated since) are kept: they do no harm and
  // come back to life if the category is reactivated.
  const categories = [...new Set(payload.knowledge_categories.map((k) => k.trim()).filter(Boolean))];

  const row = {
    squadhub_item_id: payload.id,
    title: payload.title.trim(),
    summary: payload.summary ?? null,
    icon: payload.icon ?? null,
    categories,
    body_text: flattenPages(payload.title, payload.summary, payload.pages),
    pages: payload.pages,
    synced_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin
    .from('knowledge_items')
    .upsert(row, { onConflict: 'squadhub_item_id' });
  if (error) throw new AppError(500, `Failed to save knowledge item: ${error.message}`);
  return { removed: false, unknown_categories: categories.filter((c) => !known.has(c)) };
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

function squadhubEditUrl(squadhubItemId: string): string {
  return `${env.SQUADHUB_ADMIN_URL.replace(/\/$/, '')}/admin/learning/${squadhubItemId}`;
}

/** Strip PostgREST filter syntax so a search box can't inject conditions. */
function searchTerm(q: string | undefined): string | null {
  const t = (q ?? '').replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 100) : null;
}

export async function listKnowledgeItems(opts: { category?: string; q?: string }) {
  let query = supabaseAdmin
    .from('knowledge_items')
    .select('id, squadhub_item_id, title, summary, icon, categories, body_text, synced_at')
    .order('title', { ascending: true })
    .limit(500);
  if (opts.category) query = query.contains('categories', [opts.category]);
  const term = searchTerm(opts.q);
  if (term) query = query.or(`title.ilike.%${term}%,body_text.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw new AppError(500, `Failed to list knowledge: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    icon: r.icon,
    categories: r.categories ?? [],
    snippet: snippet(r.body_text, term),
    synced_at: r.synced_at,
    edit_url: squadhubEditUrl(r.squadhub_item_id),
  }));
}

/** ~180 chars of body around the first match (or from the start). */
function snippet(body: string, term: string | null): string {
  const text = (body ?? '').replace(/\s+/g, ' ').trim();
  if (!term) return text.slice(0, 180);
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return text.slice(0, 180);
  const start = Math.max(0, at - 60);
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 180)}`;
}

export async function getKnowledgeItem(id: string) {
  const { data, error } = await supabaseAdmin
    .from('knowledge_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to load knowledge item: ${error.message}`);
  if (!data) throw new AppError(404, 'Knowledge item not found');
  return { ...data, edit_url: squadhubEditUrl((data as any).squadhub_item_id) };
}

/** Counts per category key, for the admin filter chips. */
export async function knowledgeCategoryCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.from('knowledge_items').select('categories');
  if (error) throw new AppError(500, `Failed to count knowledge: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    for (const k of ((r as any).categories ?? []) as string[]) counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

export async function listKnowledgeSuggestions(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const { data, error } = await supabaseAdmin
    .from('knowledge_suggestions')
    .select('id, question, answer, categories, source, source_ref, status, reviewed_at, review_note, created_at')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new AppError(500, `Failed to list suggestions: ${error.message}`);
  return data ?? [];
}
