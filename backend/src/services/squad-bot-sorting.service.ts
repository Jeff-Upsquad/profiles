// ---------------------------------------------------------------------------
// Squad Bot, job 2 — sort new contacts.
//
// Someone who messages UpSquad's WhatsApp directly lands on the CRM's Default
// Candidate Pipeline. Squad Bot asks which role they're looking for and, once
// it's clear, moves their card to that role's board; the board's own
// automations take it from there (the landing page, the team's intro). Anyone
// who isn't looking for work, or whose role has no board, goes to the team.
//
// "Ask everyone waiting" (Squad Bot Inbox) sends the question to the contacts
// already sitting on that board: as a text inside WhatsApp's 24-hour window,
// otherwise as the approved template with the same wording.
// ---------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { HANDOFF_MESSAGE, historyToMessages, introNote, isNewConversation, knowledgeBlock, type ChatLine } from '../lib/squad-bot-prompt.js';
import {
  DEFAULT_SORT_ROLES,
  askRoleText,
  movedLine,
  moveTool,
  sortingContext,
  sortingInstructions,
  type SortRole,
} from '../lib/squad-bot-sorting.js';
import {
  HANDOFF_TOOL,
  addMessage,
  crmPost,
  handOff,
  recentLines,
  squadBotClient,
  whatsappConversation,
  type ConversationRow,
  type WhatsAppInbound,
} from './squad-bot.service.js';
import { adminInstructions, botModel } from '../lib/squadhub-bot.js';
import { hubBotConfig, reportUsage } from './squadhub-bot.service.js';

const HISTORY_TURNS = 20;
const MAX_ASK_PER_RUN = 25;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SortingSettings {
  /** off: leave the board to the team; auto: ask and move on its own. */
  mode: 'off' | 'auto';
  /** The CRM board direct contacts land on. */
  pipeline: string;
  /** Approved WhatsApp template for asking outside the 24-hour window. */
  template: string;
  template_language: string;
  roles: SortRole[];
}

const SORTING_DEFAULTS: SortingSettings = {
  mode: 'auto',
  pipeline: 'Default Candidate Pipeline',
  template: 'squad_bot_which_role',
  template_language: 'en_US',
  roles: DEFAULT_SORT_ROLES,
};

export async function getSortingSettings(): Promise<SortingSettings> {
  const { getAdminSetting } = await import('./admin.service.js');
  const saved = await getAdminSetting<Partial<SortingSettings>>('squad_bot_sorting');
  return { ...SORTING_DEFAULTS, ...(saved ?? {}) };
}

export async function setSortingMode(mode: SortingSettings['mode'], adminId: string) {
  const { setAdminSetting } = await import('./admin.service.js');
  const next = { ...(await getSortingSettings()), mode };
  await setAdminSetting('squad_bot_sorting', next, adminId);
  return next;
}

/** Is this (lower-cased) CRM board the one Squad Bot sorts, with the job switched on? */
export async function isSortingPipeline(pipeline: string): Promise<boolean> {
  const s = await getSortingSettings();
  return s.mode !== 'off' && pipeline === s.pipeline.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// A message from a contact on the board
// ---------------------------------------------------------------------------

export async function sortWhatsAppContact(msg: WhatsAppInbound): Promise<void> {
  try {
    const settings = await getSortingSettings();
    const conv = await whatsappConversation(msg);
    await addMessage(conv.id, { sender: 'talent', body: msg.text, channel: 'whatsapp', crm_message_id: msg.message_id });
    // With the team: recruiters answer in the CRM; the bot stays quiet.
    if (conv.status === 'handoff') return;

    const result = await decide(conv, settings);
    if (result.text) {
      const reply = await addMessage(conv.id, { sender: 'bot', body: result.text, channel: 'whatsapp', meta: result.meta });
      const sent = await crmPost('reply', {
        lead_id: msg.lead_id,
        reply_to_message_id: msg.message_id,
        text: reply.body,
        mode: 'send',
        handoff: result.handoff,
      });
      if (!sent?.ok) {
        await addMessage(conv.id, { sender: 'system', body: `Squad Bot's reply was not sent on WhatsApp (${sent?.error ?? 'CRM not connected'}).` });
      }
    }
    if (result.move) await moveContact(conv, msg.lead_id, result.move.role, result.move.summary);
    else if (result.handoff) await handOff(conv, result.handoff.reason, result.handoff.summary);
  } catch (err) {
    console.error('[squad-bot] sorting message failed:', (err as Error)?.message ?? err);
  }
}

interface Decision {
  text: string;
  move: { role: SortRole; summary: string } | null;
  handoff: { reason: string; summary: string } | null;
  meta: Record<string, unknown>;
}

/** Squad Bot reads the chat and asks, moves, or hands off. */
async function decide(conv: ConversationRow, settings: SortingSettings): Promise<Decision> {
  const meta: Record<string, unknown> = { job: 'sort' };
  const api = squadBotClient();
  if (!api) {
    return { text: HANDOFF_MESSAGE, move: null, handoff: { reason: 'other', summary: 'Squad Bot is not switched on yet (no ANTHROPIC_API_KEY), so this new contact came straight to the team.' }, meta };
  }

  const lines = (await recentLines(conv.id, HISTORY_TURNS)) as Array<ChatLine & { created_at: string }>;
  const { data: knowledge } = await supabaseAdmin
    .from('knowledge_items')
    .select('title, body_text')
    .overlaps('categories', ['general'])
    .order('title', { ascending: true });
  const accountCategories = conv.talent_user_id ? await accountCategoriesOf(conv.talent_user_id) : null;
  const hub = await hubBotConfig();
  const model = botModel(hub, env.SQUAD_BOT_MODEL);
  const startedAt = Date.now();

  try {
    const response = await api.beta.messages.create({
      model,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: sortingInstructions(settings.roles) },
        { type: 'text', text: knowledgeBlock(knowledge ?? []), cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: [
            `The person you're chatting with:\n${sortingContext({ name: conv.contact_name, accountCategories })}`,
            introNote(isNewConversation(lines)),
            adminInstructions(hub),
          ].filter(Boolean).join('\n\n'),
        },
      ],
      tools: [moveTool(settings.roles), HANDOFF_TOOL],
      messages: historyToMessages(lines),
    });
    meta.model = response.model;
    meta.usage = { input: response.usage.input_tokens, output: response.usage.output_tokens, cache_read: response.usage.cache_read_input_tokens ?? 0 };
    reportUsage({
      ok: true,
      status: hub?.status ?? null,
      model: response.model,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      latency_ms: Date.now() - startedAt,
    });

    if (response.stop_reason === 'refusal') {
      return { text: HANDOFF_MESSAGE, move: null, handoff: { reason: 'other', summary: 'Squad Bot declined to answer this new contact.' }, meta };
    }
    let text = '';
    let move: Decision['move'] = null;
    let handoff: Decision['handoff'] = null;
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
      if (block.type !== 'tool_use') continue;
      const input = block.input as { team?: unknown; reason?: unknown; summary?: unknown };
      const summary = typeof input?.summary === 'string' ? input.summary : '';
      if (block.name === 'move_to_team') {
        const role = settings.roles.find((r) => r.key === input?.team);
        if (role) move = { role, summary };
      }
      if (block.name === 'hand_off_to_team') {
        handoff = { reason: typeof input?.reason === 'string' ? input.reason : 'other', summary: summary || 'New contact needs the team.' };
      }
    }
    if (move) meta.moved_to = move.role.pipeline;
    // A move wins over a handoff in the same turn; nothing at all goes to the team.
    if (move) handoff = null;
    if (!text.trim() && !move && !handoff) handoff = { reason: 'other', summary: 'Squad Bot had no reply for this new contact.' };
    // Never move or hand off in silence: the person always hears what happens next.
    if (!text.trim()) text = move ? movedLine(move.role) : handoff ? HANDOFF_MESSAGE : '';
    return { text: text.trim(), move, handoff, meta };
  } catch (err) {
    const status = err instanceof Anthropic.APIError ? err.status : undefined;
    console.error('[squad-bot] sorting call failed:', status ?? '', (err as Error)?.message ?? err);
    meta.error = status ? `api_${status}` : 'network';
    reportUsage({ ok: false, status: hub?.status ?? null, model, error: String(meta.error), latency_ms: Date.now() - startedAt });
    return { text: HANDOFF_MESSAGE, move: null, handoff: { reason: 'other', summary: 'Squad Bot could not sort this new contact (service error), so it came to the team.' }, meta };
  }
}

async function accountCategoriesOf(talentUserId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('talent_profiles')
    .select('category:categories(name)')
    .eq('talent_user_id', talentUserId);
  return [...new Set((data ?? []).map((p: any) => p.category?.name?.trim()).filter(Boolean))] as string[];
}

/** Move the card to the role's board. If the CRM can't, the team takes over. */
async function moveContact(conv: ConversationRow, leadId: string, role: SortRole, summary: string) {
  const moved = await crmPost('move', { lead_id: leadId, pipeline_name: role.pipeline, stage_name: role.stage });
  if (moved?.ok) {
    await supabaseAdmin.from('squad_bot_conversations').update({ crm_pipeline_name: role.pipeline }).eq('id', conv.id);
    await addMessage(conv.id, {
      sender: 'system',
      body: `Squad Bot moved them to ${role.pipeline} (${moved.stage_name ?? role.stage})${summary ? `: ${summary}` : '.'}`,
      meta: { job: 'sort', moved_to: role.pipeline },
    });
    return;
  }
  const why = moved?.error === 'already_on_board'
    ? `They already have a card on ${role.pipeline}, so their Default Candidate Pipeline card was left for you to tidy up.`
    : `Squad Bot couldn't move them to ${role.pipeline} (${moved?.error ?? 'CRM not connected'}).`;
  await handOff(conv, 'other', `${summary ? `${summary}. ` : ''}${why}`);
}

// ---------------------------------------------------------------------------
// "Ask everyone waiting"
// ---------------------------------------------------------------------------

interface WaitingLead {
  id: string;
  phone: string | null;
  name: string | null;
  stage_name: string | null;
}

/** Contacts on the board Squad Bot hasn't asked yet. */
export async function waitingContacts() {
  const settings = await getSortingSettings();
  const res = await crmPost('unsorted', { pipeline_name: settings.pipeline });
  if (!res?.ok) throw new AppError(502, `Could not read the ${settings.pipeline} from the CRM (${res?.error ?? 'CRM not connected'}).`);
  const leads = ((res.leads ?? []) as WaitingLead[]).filter((l) => l.phone);
  const asked = await alreadyAsked(leads.map((l) => l.id));
  return { settings, leads: leads.filter((l) => !asked.has(l.id)), total: leads.length };
}

/** CRM lead ids whose chat already has a Squad Bot or team message. */
async function alreadyAsked(leadIds: string[]): Promise<Set<string>> {
  if (!leadIds.length) return new Set();
  const { data: convs } = await supabaseAdmin
    .from('squad_bot_conversations')
    .select('id, crm_lead_id, status')
    .in('crm_lead_id', leadIds);
  const out = new Set<string>();
  const byConv = new Map<string, string>();
  for (const c of convs ?? []) {
    if ((c as any).status === 'handoff') out.add((c as any).crm_lead_id);
    else byConv.set((c as any).id, (c as any).crm_lead_id);
  }
  if (byConv.size) {
    const { data: spoken } = await supabaseAdmin
      .from('squad_bot_messages')
      .select('conversation_id')
      .in('conversation_id', [...byConv.keys()])
      .in('sender', ['bot', 'staff']);
    for (const m of spoken ?? []) out.add(byConv.get((m as any).conversation_id)!);
  }
  return out;
}

export async function askWaitingContacts(staff: { id: string; name: string }) {
  const { settings, leads } = await waitingContacts();
  if (settings.mode === 'off') throw new AppError(409, 'Switch "Sort new contacts" on first.');
  const result = { asked: 0, by_template: 0, failed: 0, remaining: Math.max(0, leads.length - MAX_ASK_PER_RUN), errors: [] as string[] };

  for (const lead of leads.slice(0, MAX_ASK_PER_RUN)) {
    const who = lead.name || lead.phone!;
    try {
      const text = askRoleText(lead.name);
      const sent = await crmPost('reply', {
        lead_id: lead.id,
        text,
        mode: 'send',
        fallback_template: { name: settings.template, language: settings.template_language },
      });
      if (!sent?.ok) {
        result.failed++;
        result.errors.push(`${who}: ${sent?.error === 'template_not_found' ? `template ${settings.template} is not approved yet` : sent?.error ?? 'not sent'}`);
        continue;
      }
      const conv = await whatsappConversation({ lead_id: lead.id, phone: lead.phone!, name: lead.name, pipeline_name: settings.pipeline, message_id: '', text: '' });
      await addMessage(conv.id, {
        sender: 'bot',
        body: text,
        channel: 'whatsapp',
        crm_message_id: sent.message_id ?? null,
        meta: { job: 'sort', asked_by: staff.name, ...(sent.via === 'template' ? { template: settings.template } : {}) },
      });
      result.asked++;
      if (sent.via === 'template') result.by_template++;
    } catch (err) {
      result.failed++;
      result.errors.push(`${who}: ${(err as Error)?.message ?? 'failed'}`);
    }
  }
  return result;
}
