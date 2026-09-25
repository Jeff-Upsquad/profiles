// ---------------------------------------------------------------------------
// Squad Bot — the talent help chat.
//
// A talent writes in their account; Squad Bot (Claude) answers from the
// Knowledge Center plus the talent's own onboarding state. When it can't, it
// hands off: the conversation waits in the admin Squad Bot Inbox, the team
// replies there, and hands it back to the bot when done. Any failure on the
// model side (no key, API error, refusal) hands off too — a talent is never
// left without an answer or a human.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import {
  HANDOFF_MESSAGE,
  SQUAD_BOT_INSTRUCTIONS,
  historyToMessages,
  knowledgeBlock,
  knowledgeKeysFor,
  talentContext,
  type ChatLine,
  type TalentBrief,
} from '../lib/squad-bot-prompt.js';

const HISTORY_TURNS = 30;
const MAX_TALENT_MESSAGES_PER_HOUR = 40;
const TALENT_CHAT_LINK = '/talent/contact-support';

const HANDOFF_TOOL: Anthropic.Beta.BetaTool = {
  name: 'hand_off_to_team',
  description:
    'Pass this conversation to the UpSquad team. Use it for anything on the always-hand-off list, or when the knowledge does not answer the question. The team replies in this same chat.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        enum: [
          'payment',
          'complaint',
          'account_status',
          'quit_or_documents',
          'specific_opportunity',
          'asked_for_person',
          'not_in_knowledge',
          'other',
        ],
      },
      summary: {
        type: 'string',
        description: 'One or two sentences for the team: what the talent needs and anything already tried.',
      },
    },
    required: ['reason', 'summary'],
    additionalProperties: false,
  },
};

let client: Anthropic | null = null;
/** The shared Claude client (null until ANTHROPIC_API_KEY is set). */
export function squadBotClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    // An organisation-level key must name the workspace it bills to.
    ...(env.ANTHROPIC_WORKSPACE_ID ? { defaultHeaders: { 'anthropic-workspace-id': env.ANTHROPIC_WORKSPACE_ID } } : {}),
  });
  return client;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

interface ConversationRow {
  id: string;
  talent_user_id: string;
  status: 'bot' | 'handoff';
  handoff_reason: string | null;
  handoff_summary: string | null;
  handoff_at: string | null;
  last_message_at: string;
}

const MESSAGE_COLUMNS = 'id, sender, body, staff_name, created_at';

async function conversationFor(talentUserId: string): Promise<ConversationRow> {
  const { data: existing, error } = await supabaseAdmin
    .from('squad_bot_conversations')
    .select('*')
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to load chat: ${error.message}`);
  if (existing) return existing as ConversationRow;
  const { data: created, error: insErr } = await supabaseAdmin
    .from('squad_bot_conversations')
    .upsert({ talent_user_id: talentUserId }, { onConflict: 'talent_user_id' })
    .select('*')
    .single();
  if (insErr || !created) throw new AppError(500, `Failed to start chat: ${insErr?.message}`);
  return created as ConversationRow;
}

async function addMessage(
  conversationId: string,
  msg: { sender: ChatLine['sender']; body: string; staff_user_id?: string | null; staff_name?: string | null; meta?: Record<string, unknown> },
) {
  const { data, error } = await supabaseAdmin
    .from('squad_bot_messages')
    .insert({ conversation_id: conversationId, ...msg })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error || !data) throw new AppError(500, `Failed to save message: ${error?.message}`);
  await supabaseAdmin
    .from('squad_bot_conversations')
    .update({ last_message_at: (data as any).created_at })
    .eq('id', conversationId);
  return data;
}

async function recentLines(conversationId: string, limit: number) {
  const { data, error } = await supabaseAdmin
    .from('squad_bot_messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new AppError(500, `Failed to load messages: ${error.message}`);
  return (data ?? []).reverse();
}

async function handOff(conv: ConversationRow, reason: string, summary: string) {
  await supabaseAdmin
    .from('squad_bot_conversations')
    .update({ status: 'handoff', handoff_reason: reason, handoff_summary: summary, handoff_at: new Date().toISOString() })
    .eq('id', conv.id);
  await addMessage(conv.id, { sender: 'system', body: `Handed to the team (${reason.replace(/_/g, ' ')}): ${summary}` });
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

export async function getTalentChat(talentUserId: string) {
  const conv = await conversationFor(talentUserId);
  const messages = (await recentLines(conv.id, 100)).filter((m: any) => m.sender !== 'system');
  return { status: conv.status, messages };
}

export async function sendTalentMessage(talentUserId: string, text: string) {
  const body = text.trim();
  if (!body) throw new AppError(400, 'Message is empty');
  const conv = await conversationFor(talentUserId);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('squad_bot_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conv.id)
    .eq('sender', 'talent')
    .gte('created_at', since);
  if ((count ?? 0) >= MAX_TALENT_MESSAGES_PER_HOUR) {
    throw new AppError(429, "You've sent a lot of messages in the last hour. Please wait a little and try again.");
  }

  const talentMsg = await addMessage(conv.id, { sender: 'talent', body });

  // Waiting on the team: they see it in the inbox; the bot stays quiet.
  if (conv.status === 'handoff') return { status: conv.status, messages: [talentMsg] };

  const reply = await answer(conv, talentUserId);
  return { status: reply.status, messages: [talentMsg, reply.message] };
}

async function answer(conv: ConversationRow, talentUserId: string) {
  const api = squadBotClient();
  if (!api) {
    await handOff(conv, 'other', 'Squad Bot is not switched on yet (no ANTHROPIC_API_KEY), so this came straight to the team.');
    return { status: 'handoff' as const, message: await addMessage(conv.id, { sender: 'bot', body: HANDOFF_MESSAGE }) };
  }

  const [brief, lines] = await Promise.all([talentBrief(talentUserId), recentLines(conv.id, HISTORY_TURNS)]);
  const { data: knowledge } = await supabaseAdmin
    .from('knowledge_items')
    .select('title, body_text')
    .overlaps('categories', brief.knowledgeKeys)
    .order('title', { ascending: true });

  let text = '';
  let handoff: { reason: string; summary: string } | null = null;
  const meta: Record<string, unknown> = { knowledge_items: knowledge?.length ?? 0 };

  try {
    const response = await api.beta.messages.create({
      model: env.SQUAD_BOT_MODEL,
      max_tokens: 4000,
      // Classifier declines re-run on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SQUAD_BOT_INSTRUCTIONS },
        // Same for every talent in these categories → cached across chats.
        { type: 'text', text: knowledgeBlock(knowledge ?? []), cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `The talent you're chatting with:\n${talentContext(brief.brief)}` },
      ],
      tools: [HANDOFF_TOOL],
      messages: historyToMessages(lines as ChatLine[]),
    });

    meta.model = response.model;
    meta.stop_reason = response.stop_reason;
    meta.usage = {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cache_read: response.usage.cache_read_input_tokens ?? 0,
      cache_write: response.usage.cache_creation_input_tokens ?? 0,
    };

    if (response.stop_reason === 'refusal') {
      handoff = { reason: 'other', summary: 'Squad Bot declined to answer this message.' };
    } else {
      for (const block of response.content) {
        if (block.type === 'text') text += block.text;
        if (block.type === 'tool_use' && block.name === 'hand_off_to_team') {
          const input = block.input as { reason?: unknown; summary?: unknown };
          handoff = {
            reason: typeof input?.reason === 'string' ? input.reason : 'other',
            summary: typeof input?.summary === 'string' ? input.summary : 'No summary given.',
          };
        }
      }
      if (!text.trim() && !handoff) handoff = { reason: 'not_in_knowledge', summary: 'Squad Bot had no answer.' };
    }
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    console.error('[squad-bot] Claude call failed:', status ?? '', (err as Error)?.message ?? err);
    meta.error = status ? `api_${status}` : 'network';
    handoff = { reason: 'other', summary: 'Squad Bot could not answer (service error), so this came straight to the team.' };
    text = '';
  }

  if (handoff) await handOff(conv, handoff.reason, handoff.summary);
  const message = await addMessage(conv.id, { sender: 'bot', body: text.trim() || HANDOFF_MESSAGE, meta });
  return { status: handoff ? ('handoff' as const) : ('bot' as const), message };
}

/** The talent's account as Squad Bot needs it (reuses the admin journey view). */
async function talentBrief(talentUserId: string): Promise<{ brief: TalentBrief; knowledgeKeys: string[] }> {
  const { talentJourney } = await import('./onboarding-hub.service.js');
  const j: any = await talentJourney(talentUserId);
  const profiles: any[] = j.profiles ?? [];
  const brief: TalentBrief = {
    first_name: (j.user?.full_name ?? '').trim().split(/\s+/)[0] || null,
    categories: [...new Set(profiles.map((p) => p.category_name?.trim()).filter(Boolean))] as string[],
    wants_jobs: !!j.user?.wants_jobs,
    partner_approval: j.user?.partner_approval_status ?? null,
    application_cancelled: !!j.user?.application_cancelled_at,
    account_inactive: j.user?.is_active === false,
    onboarding_course_done: !!j.journey?.onboarding_completed,
    basic_missing: (j.journey?.basic_checklist ?? []).filter((c: any) => c.required && !c.done).map((c: any) => c.label),
    job_profiles: profiles.map((p) => ({
      category: p.category_name?.trim() ?? null,
      status: p.status,
      requested_changes: (p.requested_changes ?? []).map((c: any) => String(c?.label ?? '')).filter(Boolean),
      portfolio_items: p.portfolio_items ?? 0,
    })),
    portfolio_required: j.journey?.portfolio_required !== false,
    portfolio_items: j.journey?.portfolio_items ?? 0,
    app_downloaded: !!j.journey?.talent_board?.app_downloaded_at,
    webinar_attended: !!j.journey?.talent_board?.webinar_attended_at,
  };
  if (!brief.categories.length && j.user?.categories?.length) {
    const label: Record<string, string> = { creative: 'Designers & Editors', accountant: 'Accountant', sales: 'Sales' };
    brief.categories = (j.user.categories as string[]).map((ft) => label[ft] ?? ft);
  }
  return {
    brief,
    knowledgeKeys: knowledgeKeysFor(j.user?.categories ?? [], profiles.map((p) => p.category_slug)),
  };
}

// ---------------------------------------------------------------------------
// Admin — Squad Bot Inbox
// ---------------------------------------------------------------------------

export async function listConversations(status: 'handoff' | 'all') {
  let query = supabaseAdmin
    .from('squad_bot_conversations')
    .select('id, talent_user_id, status, handoff_reason, handoff_summary, handoff_at, last_message_at, talent:talent_users(full_name, phone)')
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (status === 'handoff') query = query.eq('status', 'handoff');
  const { data, error } = await query;
  if (error) throw new AppError(500, `Failed to list chats: ${error.message}`);

  const ids = (data ?? []).map((c: any) => c.id);
  const lastBy = new Map<string, { sender: string; body: string }>();
  if (ids.length) {
    const { data: msgs } = await supabaseAdmin
      .from('squad_bot_messages')
      .select('conversation_id, sender, body, created_at')
      .in('conversation_id', ids)
      .neq('sender', 'system')
      .order('created_at', { ascending: false })
      .limit(ids.length * 5);
    for (const m of msgs ?? []) if (!lastBy.has((m as any).conversation_id)) lastBy.set((m as any).conversation_id, m as any);
  }
  return (data ?? []).map((c: any) => ({
    id: c.id,
    talent_user_id: c.talent_user_id,
    talent_name: c.talent?.full_name ?? null,
    talent_phone: c.talent?.phone ?? null,
    status: c.status,
    handoff_reason: c.handoff_reason,
    handoff_summary: c.handoff_summary,
    handoff_at: c.handoff_at,
    last_message_at: c.last_message_at,
    last_message: lastBy.get(c.id) ?? null,
  }));
}

export async function handoffCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('squad_bot_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'handoff');
  if (error) throw new AppError(500, error.message);
  return count ?? 0;
}

export async function getConversation(id: string) {
  const { data: conv, error } = await supabaseAdmin
    .from('squad_bot_conversations')
    .select('*, talent:talent_users(full_name, phone)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!conv) throw new AppError(404, 'Chat not found');
  return { ...(conv as any), messages: await recentLines(id, 300) };
}

export async function staffReply(id: string, staff: { id: string; name: string }, text: string) {
  const body = text.trim();
  if (!body) throw new AppError(400, 'Reply is empty');
  const conv = (await getConversation(id)) as ConversationRow;
  const message = await addMessage(id, { sender: 'staff', body, staff_user_id: staff.id, staff_name: staff.name });
  const { notifyTalentsInApp } = await import('./jobs.service.js');
  void notifyTalentsInApp([conv.talent_user_id], 'squad_bot_reply', 'The UpSquad team replied', body.slice(0, 140), TALENT_CHAT_LINK);
  return message;
}

/** Done with a handoff: Squad Bot answers this talent again. */
export async function handBack(id: string, staff: { id: string; name: string }) {
  const { data: before } = await supabaseAdmin
    .from('squad_bot_conversations').select('handoff_at').eq('id', id).maybeSingle();
  const { error } = await supabaseAdmin
    .from('squad_bot_conversations')
    .update({ status: 'bot', handoff_reason: null, handoff_summary: null, handoff_at: null })
    .eq('id', id);
  if (error) throw new AppError(500, error.message);
  await addMessage(id, { sender: 'system', body: `${staff.name} handed the chat back to Squad Bot.`, staff_user_id: staff.id, staff_name: staff.name });
  // Learning loop: draft a knowledge entry from the team's answer, if it's reusable.
  const handoffAt = (before as { handoff_at?: string | null } | null)?.handoff_at;
  if (handoffAt) {
    const { draftFromHandoff } = await import('./knowledge-learning.service.js');
    void draftFromHandoff(id, handoffAt);
  }
  return { status: 'bot' as const };
}
