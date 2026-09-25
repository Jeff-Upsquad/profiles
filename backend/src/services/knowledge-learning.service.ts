// ---------------------------------------------------------------------------
// Squad Bot learning loop.
//
// When the team hands a chat back to Squad Bot, Claude reads the handoff and
// the team's replies and — only if the answer is general, not about this one
// talent — drafts a Q&A into knowledge_suggestions. An admin edits and
// approves it in the Knowledge Center; approval creates a published Knowledge
// item in SquadHub (the home of all knowledge), which syncs straight back here.
// ---------------------------------------------------------------------------

import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import {
  DRAFT_INSTRUCTIONS,
  cleanDraft,
  draftRequest,
  draftSchema,
  type DraftResult,
  type TranscriptLine,
} from '../lib/knowledge-draft.js';

const TRANSCRIPT_LIMIT = 40;

/** Draft a knowledge suggestion from one handoff. Best-effort; never throws. */
export async function draftFromHandoff(conversationId: string, handoffAt: string): Promise<void> {
  try {
    const sourceRef = `${conversationId}:${handoffAt}`;
    const { data: already } = await supabaseAdmin
      .from('knowledge_suggestions').select('id').eq('source_ref', sourceRef).maybeSingle();
    if (already) return;

    const { data: rows } = await supabaseAdmin
      .from('squad_bot_messages')
      .select('sender, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(TRANSCRIPT_LIMIT);
    const lines = ((rows ?? []) as Array<TranscriptLine & { created_at: string }>).reverse();
    // Nothing to learn unless a person answered (or instructed Squad Bot) after the handoff.
    if (!lines.some((l) => (l.sender === 'staff' || l.sender === 'instruction') && l.created_at >= handoffAt)) return;

    const { squadBotClient } = await import('./squad-bot.service.js');
    const api = squadBotClient();
    if (!api) return;

    const { listKnowledgeCategories } = await import('./knowledge.service.js');
    const categories = await listKnowledgeCategories();
    const keys = categories.map((c) => c.key);
    const { data: existing } = await supabaseAdmin.from('knowledge_items').select('title').order('title');

    const response = await api.messages.create({
      model: env.SQUAD_BOT_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: draftSchema(keys) } },
      system: DRAFT_INSTRUCTIONS,
      messages: [{
        role: 'user',
        content: draftRequest({
          lines,
          categories,
          existingTitles: (existing ?? []).map((e: { title: string }) => e.title),
        }),
      }],
    });
    if (response.stop_reason !== 'end_turn') return;

    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return;
    const draft = cleanDraft(JSON.parse(text.text) as DraftResult, keys);
    if (!draft) return;

    const { error } = await supabaseAdmin.from('knowledge_suggestions').insert({
      question: draft.question,
      answer: draft.answer,
      categories: draft.categories,
      source: 'handoff',
      source_ref: sourceRef,
    });
    if (error) console.error('[knowledge-learning] save failed:', error.message);
  } catch (err) {
    console.error('[knowledge-learning] draft failed:', (err as Error)?.message ?? err);
  }
}

// ---------------------------------------------------------------------------
// Approve / reject (admin Knowledge Center → Pending approvals)
// ---------------------------------------------------------------------------

function squadHubApiBase(): string {
  if (env.SQUADHUB_API_URL) return env.SQUADHUB_API_URL.replace(/\/$/, '');
  if (env.SQUADHUB_CALLBACK_URL) return new URL(env.SQUADHUB_CALLBACK_URL).origin;
  return '';
}

async function pendingSuggestion(id: string) {
  const { data, error } = await supabaseAdmin.from('knowledge_suggestions').select('*').eq('id', id).maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Suggestion not found');
  if ((data as any).status !== 'pending') throw new AppError(409, 'This suggestion was already reviewed');
  return data as any;
}

export async function approveSuggestion(
  id: string,
  input: { question: string; answer: string; categories: string[] },
  reviewer: { authUserId: string | null; name: string },
) {
  await pendingSuggestion(id);
  const base = squadHubApiBase();
  const secret = env.SQUADHUB_CALLBACK_SECRET;
  if (!base || !secret) throw new AppError(503, 'SquadHub is not connected, so the answer cannot be saved');

  const res = await fetch(`${base}/integrations/squadhire/knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-SquadHub-Signature': secret },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => ({}))) as { data?: { id?: string }; error?: string };
  if (!res.ok || !body.data?.id) {
    throw new AppError(502, `SquadHub could not save it: ${body.error ?? `HTTP ${res.status}`}`);
  }

  const { data, error } = await supabaseAdmin
    .from('knowledge_suggestions')
    .update({
      question: input.question,
      answer: input.answer,
      categories: input.categories,
      status: 'approved',
      squadhub_item_id: body.data.id,
      reviewed_by: reviewer.authUserId,
      reviewed_at: new Date().toISOString(),
      review_note: `Approved by ${reviewer.name}`,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  return data;
}

export async function rejectSuggestion(id: string, reviewer: { authUserId: string | null; name: string }) {
  await pendingSuggestion(id);
  const { data, error } = await supabaseAdmin
    .from('knowledge_suggestions')
    .update({
      status: 'rejected',
      reviewed_by: reviewer.authUserId,
      reviewed_at: new Date().toISOString(),
      review_note: `Rejected by ${reviewer.name}`,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  return data;
}
