// ---------------------------------------------------------------------------
// Squad Bot — UpSquad's assistant. It has two jobs:
//
//   Job 1 — answer talents (this file): in the app and on WhatsApp boards,
//           answer from the Knowledge Center and hand off what it can't.
//   Job 2 — sort new contacts (squad-bot-sorting.service.ts): people who
//           message WhatsApp directly land on the CRM's Default Candidate
//           Pipeline; ask which role they want and move them to that board.
//
// Job 1 in detail:
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
  ACT_ON_INSTRUCTION,
  fetchDomains,
  historyToMessages,
  introNote,
  isNewConversation,
  knowledgeBlock,
  knowledgeKeysFor,
  talentContext,
  teamInstructions,
  formTypeForPipeline,
  prospectContext,
  WHATSAPP_NOTE,
  type ChatLine,
  type TalentBrief,
} from '../lib/squad-bot-prompt.js';

const HISTORY_TURNS = 30;
const MAX_TALENT_MESSAGES_PER_HOUR = 40;
const TALENT_CHAT_LINK = '/talent/contact-support';

export const HANDOFF_TOOL: Anthropic.Beta.BetaTool = {
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

export interface ConversationRow {
  id: string;
  talent_user_id: string | null;
  phone: string | null;
  contact_name: string | null;
  crm_lead_id: string | null;
  crm_pipeline_name: string | null;
  status: 'bot' | 'handoff';
  handoff_reason: string | null;
  handoff_summary: string | null;
  handoff_at: string | null;
  last_message_at: string;
}

const MESSAGE_COLUMNS = 'id, sender, body, channel, staff_name, created_at';

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

export async function addMessage(
  conversationId: string,
  msg: {
    sender: ChatLine['sender'];
    body: string;
    channel?: 'app' | 'whatsapp';
    crm_message_id?: string | null;
    staff_user_id?: string | null;
    staff_name?: string | null;
    meta?: Record<string, unknown>;
  },
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

export async function recentLines(conversationId: string, limit: number) {
  const { data, error } = await supabaseAdmin
    .from('squad_bot_messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new AppError(500, `Failed to load messages: ${error.message}`);
  return (data ?? []).reverse();
}

export async function handOff(conv: ConversationRow, reason: string, summary: string) {
  await supabaseAdmin
    .from('squad_bot_conversations')
    .update({ status: 'handoff', handoff_reason: reason, handoff_summary: summary, handoff_at: new Date().toISOString() })
    .eq('id', conv.id);
  await addMessage(conv.id, { sender: 'system', body: `Handed to the team (${reason.replace(/_/g, ' ')}): ${summary}` });
  // Push to the team's CRM app so a person picks it up.
  const who = await contactOf(conv);
  void crmAlert({
    title: `Squad Bot needs you: ${who.name}`,
    body: summary,
    lead_id: conv.crm_lead_id,
    phone: who.phone,
  });
}

async function contactOf(conv: ConversationRow): Promise<{ name: string; phone: string | null }> {
  if (conv.talent_user_id) {
    const { data } = await supabaseAdmin.from('talent_users').select('full_name, phone').eq('id', conv.talent_user_id).maybeSingle();
    const t = data as { full_name?: string | null; phone?: string | null } | null;
    return { name: t?.full_name || conv.contact_name || 'a talent', phone: t?.phone ?? conv.phone };
  }
  return { name: conv.contact_name || conv.phone || 'a talent', phone: conv.phone };
}

// ---------------------------------------------------------------------------
// SquadHire CRM (WhatsApp) — replies and alerts go through the CRM, signed with
// the same secret as the other Profiles → CRM calls.
// ---------------------------------------------------------------------------

function crmCall(path: string): { url: string; headers: Record<string, string> } | null {
  const events = env.SQUADHIRE_CRM_SYSTEM_EVENTS_URL;
  const secret = process.env.SQUADHIRE_CRM_INBOUND_SECRET;
  if (!events || !secret) return null;
  return {
    url: `${new URL(events).origin}/integrations/profiles/squad-bot/${path}`,
    headers: { 'Content-Type': 'application/json', 'X-SquadHire-Admin-Signature': secret },
  };
}

export async function crmPost(path: string, body: Record<string, unknown>): Promise<Record<string, any> | null> {
  const call = crmCall(path);
  if (!call) return null;
  try {
    const res = await fetch(call.url, { method: 'POST', headers: call.headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      console.error(`[squad-bot] CRM ${path} http_${res.status}:`, json?.error ?? '');
      return { ok: false, error: json?.error ?? `http_${res.status}` };
    }
    return { ok: true, ...json };
  } catch (err) {
    console.error(`[squad-bot] CRM ${path} failed:`, (err as Error)?.message ?? err);
    return { ok: false, error: 'unreachable' };
  }
}

function crmAlert(input: { title: string; body: string; lead_id: string | null; phone: string | null }) {
  return crmPost('alert', input);
}

/** WhatsApp mode for Squad Bot: off, draft (a person sends it) or auto. */
export interface WhatsAppSettings {
  mode: 'off' | 'draft' | 'auto';
  pipelines: string[];
}
const WHATSAPP_DEFAULTS: WhatsAppSettings = { mode: 'draft', pipelines: ['Designers and Editors', 'Accountants'] };

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { getAdminSetting } = await import('./admin.service.js');
  const saved = await getAdminSetting<Partial<WhatsAppSettings>>('squad_bot_whatsapp');
  return { ...WHATSAPP_DEFAULTS, ...(saved ?? {}) };
}

export async function setWhatsAppMode(mode: WhatsAppSettings['mode'], adminId: string) {
  const { setAdminSetting } = await import('./admin.service.js');
  const next = { ...(await getWhatsAppSettings()), mode };
  await setAdminSetting('squad_bot_whatsapp', next, adminId);
  return next;
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

export async function getTalentChat(talentUserId: string) {
  const conv = await conversationFor(talentUserId);
  // The app shows the app side only; WhatsApp lines (incl. drafts a recruiter
  // may have dismissed) live in the CRM chat. Squad Bot still reads both.
  const messages = (await recentLines(conv.id, 100)).filter(
    (m: any) => ['talent', 'bot', 'staff'].includes(m.sender) && m.channel !== 'whatsapp',
  );
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

  const reply = await answer(conv, 'app');
  return { status: reply.status, messages: [talentMsg, reply.message] };
}

/** Who Squad Bot is talking to, and the knowledge that applies to them. */
async function subjectFor(conv: ConversationRow): Promise<{ context: string; knowledgeKeys: string[] }> {
  if (conv.talent_user_id) {
    const brief = await talentBrief(conv.talent_user_id);
    return { context: talentContext(brief.brief), knowledgeKeys: brief.knowledgeKeys };
  }
  const ft = formTypeForPipeline(conv.crm_pipeline_name);
  return {
    context: prospectContext({ name: conv.contact_name, pipelineName: conv.crm_pipeline_name }),
    knowledgeKeys: knowledgeKeysFor(ft ? [ft] : [], []),
  };
}

/** Pause/resume rounds for a long server-tool (web_fetch) turn. */
const MAX_CONTINUATIONS = 3;

/**
 * Squad Bot writes its next message. `instructed`: the team just gave it a
 * private instruction; if it can't carry it out, it tells the team (a note in
 * the inbox) instead of writing to the talent.
 */
async function answer(
  conv: ConversationRow,
  channel: 'app' | 'whatsapp',
  extraMeta: Record<string, unknown> = {},
  opts: { instructed?: boolean } = {},
) {
  const api = squadBotClient();
  if (!api) {
    if (opts.instructed) throw new AppError(503, 'Squad Bot is not switched on yet (no ANTHROPIC_API_KEY).');
    await handOff(conv, 'other', 'Squad Bot is not switched on yet (no ANTHROPIC_API_KEY), so this came straight to the team.');
    return {
      status: 'handoff' as const,
      handoff: { reason: 'other', summary: 'Squad Bot is not switched on.' },
      message: await addMessage(conv.id, { sender: 'bot', body: HANDOFF_MESSAGE, channel, meta: extraMeta }),
    };
  }

  const [subject, rawLines] = await Promise.all([subjectFor(conv), recentLines(conv.id, HISTORY_TURNS)]);
  const lines = rawLines as Array<ChatLine & { created_at: string }>;
  const { data: knowledge } = await supabaseAdmin
    .from('knowledge_items')
    .select('title, body_text')
    .overlaps('categories', subject.knowledgeKeys)
    .order('title', { ascending: true });

  const instructions = teamInstructions(lines);
  const messages: Anthropic.Beta.BetaMessageParam[] = historyToMessages(lines);
  if (opts.instructed && messages[messages.length - 1]?.role !== 'user') {
    messages.push({ role: 'user', content: ACT_ON_INSTRUCTION });
  }
  const webFetch: Anthropic.Beta.BetaWebFetchTool20260209 = {
    type: 'web_fetch_20260209',
    name: 'web_fetch',
    max_uses: 3,
    allowed_domains: fetchDomains([
      ...(knowledge ?? []).map((k: { body_text: string }) => k.body_text),
      ...lines.filter((l) => l.sender === 'instruction').map((l) => l.body),
    ]),
  };

  let text = '';
  let handoff: { reason: string; summary: string } | null = null;
  const meta: Record<string, unknown> = { ...extraMeta, knowledge_items: knowledge?.length ?? 0 };

  try {
    const usage = { input: 0, output: 0, cache_read: 0, cache_write: 0 };
    let fetches = 0;
    for (let round = 0; ; round++) {
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
          {
            type: 'text',
            text: [
              `The person you're chatting with:\n${subject.context}`,
              introNote(isNewConversation(lines)),
              instructions,
              opts.instructed ? 'The newest team instruction was just given: act on it in this reply.' : '',
              channel === 'whatsapp' ? WHATSAPP_NOTE : '',
            ].filter(Boolean).join('\n\n'),
          },
        ],
        tools: [HANDOFF_TOOL, webFetch],
        messages,
      });

      meta.model = response.model;
      meta.stop_reason = response.stop_reason;
      usage.input += response.usage.input_tokens;
      usage.output += response.usage.output_tokens;
      usage.cache_read += response.usage.cache_read_input_tokens ?? 0;
      usage.cache_write += response.usage.cache_creation_input_tokens ?? 0;

      if (response.stop_reason === 'refusal') {
        handoff = { reason: 'other', summary: 'Squad Bot declined to answer this message.' };
        text = '';
        break;
      }
      for (const block of response.content) {
        if (block.type === 'text') text += block.text;
        if (block.type === 'server_tool_use' && block.name === 'web_fetch') fetches++;
        if (block.type === 'tool_use' && block.name === 'hand_off_to_team') {
          const input = block.input as { reason?: unknown; summary?: unknown };
          handoff = {
            reason: typeof input?.reason === 'string' ? input.reason : 'other',
            summary: typeof input?.summary === 'string' ? input.summary : 'No summary given.',
          };
        }
      }
      // A long web_fetch turn pauses; send it back as-is to let it finish.
      if (response.stop_reason === 'pause_turn' && round < MAX_CONTINUATIONS) {
        messages.push({ role: 'assistant', content: response.content });
        continue;
      }
      break;
    }
    meta.usage = usage;
    if (fetches) meta.web_fetches = fetches;
    if (!text.trim() && !handoff) handoff = { reason: 'not_in_knowledge', summary: 'Squad Bot had no answer.' };
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    console.error('[squad-bot] Claude call failed:', status ?? '', (err as Error)?.message ?? err);
    if (opts.instructed) throw new AppError(502, 'Squad Bot could not run that instruction (service error). Try again.');
    meta.error = status ? `api_${status}` : 'network';
    handoff = { reason: 'other', summary: 'Squad Bot could not answer (service error), so this came straight to the team.' };
    text = '';
  }

  if (opts.instructed && handoff) {
    // Couldn't do it: tell the team, not the talent.
    await addMessage(conv.id, { sender: 'system', body: `Squad Bot couldn't do that: ${handoff.summary}`, meta });
    return { status: 'handoff' as const, message: null, handoff };
  }
  if (handoff) await handOff(conv, handoff.reason, handoff.summary);
  const message = await addMessage(conv.id, { sender: 'bot', body: text.trim() || HANDOFF_MESSAGE, channel, meta });
  return { status: handoff ? ('handoff' as const) : ('bot' as const), message, handoff };
}

// ---------------------------------------------------------------------------
// WhatsApp (via SquadHire CRM)
// ---------------------------------------------------------------------------

export interface WhatsAppInbound {
  lead_id: string;
  phone: string;
  name: string | null;
  pipeline_name: string | null;
  message_id: string;
  text: string;
}

async function talentIdByPhone(phone: string): Promise<string | null> {
  const { normalizePhoneDigits, phoneMatchSuffix } = await import('../lib/phone.js');
  const last10 = phoneMatchSuffix(phone);
  if (!last10 || last10.length < 10) return null;
  const { data } = await supabaseAdmin
    .from('talent_users')
    .select('id, phone')
    .ilike('phone', `%${last10.slice(-4)}`)
    .limit(200);
  return (data ?? []).find((r: any) => normalizePhoneDigits(r.phone).slice(-10) === last10)?.id ?? null;
}

/** One conversation per person: the talent's (shared with the app) or, before signup, the phone's. */
export async function whatsappConversation(msg: WhatsAppInbound): Promise<ConversationRow> {
  const talentId = await talentIdByPhone(msg.phone);
  const link = { crm_lead_id: msg.lead_id, crm_pipeline_name: msg.pipeline_name, contact_name: msg.name };
  if (talentId) {
    const conv = await conversationFor(talentId);
    await supabaseAdmin.from('squad_bot_conversations').update(link).eq('id', conv.id);
    return { ...conv, ...link };
  }
  const { data, error } = await supabaseAdmin
    .from('squad_bot_conversations')
    .upsert({ phone: msg.phone, ...link }, { onConflict: 'phone' })
    .select('*')
    .single();
  if (error || !data) throw new AppError(500, `Failed to open WhatsApp chat: ${error?.message}`);
  return data as ConversationRow;
}

/**
 * A talent or lead wrote on WhatsApp (forwarded by the CRM). Squad Bot answers
 * and the reply goes back to the CRM: as a suggested reply a recruiter sends
 * (draft mode) or sent straight away (auto mode).
 */
export async function handleWhatsAppMessage(msg: WhatsAppInbound): Promise<void> {
  try {
    const pipeline = (msg.pipeline_name ?? '').trim().toLowerCase();
    // Job 2: a direct contact nobody has sorted yet.
    const sorting = await import('./squad-bot-sorting.service.js');
    if (await sorting.isSortingPipeline(pipeline)) return sorting.sortWhatsAppContact(msg);

    const settings = await getWhatsAppSettings();
    if (settings.mode === 'off') return;
    if (!settings.pipelines.some((p) => pipeline === p.trim().toLowerCase())) return;

    const conv = await whatsappConversation(msg);
    await addMessage(conv.id, { sender: 'talent', body: msg.text, channel: 'whatsapp', crm_message_id: msg.message_id });
    // Handed to the team: recruiters answer in the CRM; the bot stays quiet.
    if (conv.status === 'handoff') return;

    const reply = await answer(conv, 'whatsapp', { mode: settings.mode });
    if (!reply.message) return;
    await crmPost('reply', {
      lead_id: msg.lead_id,
      reply_to_message_id: msg.message_id,
      text: reply.message.body,
      mode: settings.mode === 'auto' ? 'send' : 'draft',
      handoff: reply.handoff ?? null,
    });
  } catch (err) {
    console.error('[squad-bot] WhatsApp message failed:', (err as Error)?.message ?? err);
  }
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
    .select('id, talent_user_id, phone, contact_name, crm_lead_id, status, handoff_reason, handoff_summary, handoff_at, last_message_at, talent:talent_users(full_name, phone)')
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
      .select('conversation_id, sender, body, channel, created_at')
      .in('conversation_id', ids)
      .neq('sender', 'system')
      .order('created_at', { ascending: false })
      .limit(ids.length * 5);
    for (const m of msgs ?? []) if (!lastBy.has((m as any).conversation_id)) lastBy.set((m as any).conversation_id, m as any);
  }
  return (data ?? []).map((c: any) => ({
    id: c.id,
    talent_user_id: c.talent_user_id,
    talent_name: c.talent?.full_name ?? c.contact_name ?? null,
    talent_phone: c.talent?.phone ?? c.phone ?? null,
    has_account: !!c.talent_user_id,
    crm_lead_id: c.crm_lead_id ?? null,
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
  const conv = (await getConversation(id)) as ConversationRow & { messages: Array<{ sender: string; channel?: string }> };

  // Reply where the person last wrote: WhatsApp goes out through the CRM.
  const lastFromThem = [...conv.messages].reverse().find((m) => m.sender === 'talent');
  if (lastFromThem?.channel === 'whatsapp' && conv.crm_lead_id) {
    const sent = await crmPost('reply', { lead_id: conv.crm_lead_id, text: body, mode: 'send', staff_name: staff.name });
    if (!sent?.ok) {
      throw new AppError(502, sent?.error === 'outside_24h_window'
        ? "Their last WhatsApp message was over 24 hours ago, so WhatsApp only allows a template. Send one from the CRM."
        : 'Could not send on WhatsApp through the CRM. Try again, or reply from the CRM.');
    }
    return addMessage(id, { sender: 'staff', body, channel: 'whatsapp', crm_message_id: sent.message_id ?? null, staff_user_id: staff.id, staff_name: staff.name });
  }

  const message = await addMessage(id, { sender: 'staff', body, staff_user_id: staff.id, staff_name: staff.name });
  if (conv.talent_user_id) {
    const { notifyTalentsInApp } = await import('./jobs.service.js');
    void notifyTalentsInApp([conv.talent_user_id], 'squad_bot_reply', 'The UpSquad team replied', body.slice(0, 140), TALENT_CHAT_LINK);
  }
  return message;
}

/**
 * The team tells Squad Bot what to do in this chat (e.g. "check their portfolio
 * and tell them what's missing", "the webinar details are at <link>"). The
 * instruction stays private; Squad Bot carries it out and replies to the talent
 * where they last wrote. Instructions also feed the learning loop.
 */
export async function instructBot(id: string, staff: { id: string; name: string }, text: string) {
  const body = text.trim();
  if (!body) throw new AppError(400, 'Instruction is empty');
  const conv = (await getConversation(id)) as ConversationRow & { messages: Array<{ sender: string; channel?: string }> };
  const instruction = await addMessage(id, { sender: 'instruction', body, staff_user_id: staff.id, staff_name: staff.name });

  const lastFromThem = [...conv.messages].reverse().find((m) => m.sender === 'talent');
  const channel = lastFromThem?.channel === 'whatsapp' && conv.crm_lead_id ? 'whatsapp' : 'app';
  const reply = await answer(conv, channel, { instructed_by: staff.name }, { instructed: true });

  if (reply.message) {
    if (channel === 'whatsapp') {
      const sent = await crmPost('reply', { lead_id: conv.crm_lead_id, text: reply.message.body, mode: 'send' });
      if (!sent?.ok) {
        await addMessage(id, { sender: 'system', body: `Squad Bot's reply was not sent on WhatsApp (${sent?.error ?? 'CRM not connected'}).` });
        throw new AppError(502, sent?.error === 'outside_24h_window'
          ? "Squad Bot wrote the reply, but their last WhatsApp message was over 24 hours ago, so WhatsApp only allows a template. Send one from the CRM."
          : 'Squad Bot wrote the reply, but it could not be sent on WhatsApp through the CRM.');
      }
    } else if (conv.talent_user_id) {
      const { notifyTalentsInApp } = await import('./jobs.service.js');
      void notifyTalentsInApp([conv.talent_user_id], 'squad_bot_reply', 'Squad Bot replied', reply.message.body.slice(0, 140), TALENT_CHAT_LINK);
    }
  }
  // A handed-off chat is learned from when it's handed back; otherwise learn now.
  if (conv.status === 'bot' && reply.message) {
    const { draftFromHandoff } = await import('./knowledge-learning.service.js');
    void draftFromHandoff(id, (instruction as { created_at: string }).created_at);
  }
  return { message: reply.message, handoff: reply.handoff ?? null };
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
