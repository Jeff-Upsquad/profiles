// Squad Bots inbox (bots.squadhub.in) ↔ SquadHire's Squad Bot chats.
//
// Each chat is recorded in Squad Bots (our message IDs keep syncs idempotent),
// so the team can follow it there. A teammate can take a chat over in Squad
// Bots: the bot then stays quiet here, and their replies are delivered from
// here like any team reply (in the app, or on WhatsApp through the CRM). Team
// guidance left in the chat's Backchannel is added to the bot's next answer.
//
// Without SQUADHUB_BOT_KEY nothing changes. If Squad Bots can't be reached the
// bot carries on as before.

import { supabaseAdmin } from '../config/supabase.js';
import { hubDoubtsConnected, hubJson } from './squadhub-bot.service.js';
import { guidanceText, inboxMessages, type BackchannelEntry } from '../lib/squad-bots-inbox.js';

const APP = 'SquadHire';
const HISTORY = 30;
const INTERVAL_MS = 15_000;
/** A claimed delivery that never finished (crash mid-send) is reported failed rather than re-sent. */
const STALE_CLAIM_MS = 10 * 60_000;

export interface InboxSync {
  conversation_id: string;
  taken_over: boolean;
  taken_over_name: string | null;
}

/** Record the chat in Squad Bots. Null when it isn't connected or reachable. */
export async function syncToInbox(conversationId: string): Promise<InboxSync | null> {
  if (!hubDoubtsConnected()) return null;
  try {
    const [{ data: conv }, { data: rows }] = await Promise.all([
      supabaseAdmin.from('squad_bot_conversations').select('*').eq('id', conversationId).maybeSingle(),
      supabaseAdmin
        .from('squad_bot_messages')
        .select('id, sender, body, staff_name, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(HISTORY),
    ]);
    if (!conv) return null;
    const messages = inboxMessages(((rows ?? []) as any[]).reverse());
    if (!messages.length) return null;
    return await hubJson<InboxSync>('conversations/sync', 'POST', {
      external_id: conv.id,
      app: APP,
      participant_id: conv.id,
      participant_name: (await contactName(conv)).slice(0, 120),
      title: (conv.crm_pipeline_name || (conv.talent_user_id ? 'In-app chat' : 'WhatsApp')).slice(0, 200),
      messages,
    });
  } catch (err) {
    console.error('[squad-bots-inbox] sync failed:', (err as Error).message);
    return null;
  }
}

async function contactName(conv: any): Promise<string> {
  if (conv.talent_user_id) {
    const { data } = await supabaseAdmin.from('talent_users').select('full_name').eq('id', conv.talent_user_id).maybeSingle();
    if ((data as any)?.full_name) return (data as any).full_name;
  }
  return conv.contact_name || conv.phone || 'Talent';
}

/** The team's Backchannel guidance for this chat, for the bot's prompt. */
export async function inboxGuidance(conversationId: string): Promise<string> {
  if (!hubDoubtsConnected()) return '';
  try {
    const state = await hubJson<{ backchannel: BackchannelEntry[] }>(
      `conversations/state?app=${encodeURIComponent(APP)}&external_id=${encodeURIComponent(conversationId)}`,
    );
    return guidanceText(state.backchannel);
  } catch {
    // Not recorded in Squad Bots yet, or unreachable: no extra guidance.
    return '';
  }
}

interface PendingDelivery {
  id: string;
  content: string;
  sender_name: string | null;
  conversation_id: string;
  app: string;
  external_id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Deliver team replies written in Squad Bots, then confirm each one. */
export async function deliverInboxReplies(): Promise<void> {
  if (!hubDoubtsConnected()) return;
  const pending = await hubJson<PendingDelivery[]>('deliveries/pending');
  for (const d of pending) {
    if (d.app !== APP) continue;
    const confirm = (status: 'sent' | 'failed', messageId?: string | null) =>
      hubJson(`conversations/${d.conversation_id}/deliveries`, 'POST', {
        message_ids: [d.id],
        status,
        ...(messageId ? { external_ids: { [d.id]: messageId } } : {}),
      });
    const local = UUID.test(d.external_id)
      ? (await supabaseAdmin.from('squad_bot_conversations').select('id').eq('id', d.external_id).maybeSingle()).data
      : null;
    const { error: claimError } = await supabaseAdmin
      .from('squad_bots_inbox_events')
      .insert({ id: d.id, conversation_id: local?.id ?? null });
    if (claimError) {
      if (claimError.code !== '23505') throw new Error(claimError.message);
      const { data: prior } = await supabaseAdmin.from('squad_bots_inbox_events').select('*').eq('id', d.id).maybeSingle();
      if (prior?.outcome === 'sent') await confirm('sent', prior.message_id);
      else if (prior?.outcome === 'failed') await confirm('failed');
      else if (prior && Date.now() - Date.parse(prior.created_at) > STALE_CLAIM_MS) {
        await supabaseAdmin.from('squad_bots_inbox_events').update({ outcome: 'failed', error: 'Interrupted before sending' }).eq('id', d.id);
        await confirm('failed');
      }
      continue;
    }
    if (!local) {
      await supabaseAdmin.from('squad_bots_inbox_events').update({ outcome: 'failed', error: 'Chat not found' }).eq('id', d.id);
      await confirm('failed');
      continue;
    }
    try {
      const { staffReply } = await import('./squad-bot.service.js');
      const message = (await staffReply(local.id, { id: null, name: d.sender_name || 'UpSquad team' }, d.content)) as { id: string };
      await supabaseAdmin.from('squad_bots_inbox_events').update({ outcome: 'sent', message_id: message.id }).eq('id', d.id);
      await confirm('sent', message.id);
    } catch (err) {
      const reason = (err as Error).message;
      await supabaseAdmin.from('squad_bots_inbox_events').update({ outcome: 'failed', error: reason.slice(0, 500) }).eq('id', d.id);
      await confirm('failed');
      console.error('[squad-bots-inbox] team reply not delivered:', reason);
    }
  }
}

let started = false;
export function startSquadBotsInbox(): void {
  if (started || !hubDoubtsConnected()) return;
  started = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await deliverInboxReplies();
    } catch (err) {
      console.error('[squad-bots-inbox] delivery tick failed:', (err as Error).message);
    } finally {
      running = false;
    }
  };
  setInterval(tick, INTERVAL_MS).unref?.();
  setTimeout(tick, 30_000).unref?.();
}
