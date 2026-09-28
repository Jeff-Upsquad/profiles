import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as bot from './squad-bot.service.js';

export async function listSupportChats(status: 'all' | 'handoff', page: number) {
  let query = supabaseAdmin.from('support_chat_conversations').select('*', { count: 'exact' })
    .order('support_last_message_at', { ascending: false }).order('id').range(page * 50, page * 50 + 49);
  if (status === 'handoff') query = query.eq('status', 'handoff');
  const [list, waiting] = await Promise.all([
    query,
    supabaseAdmin.from('support_chat_conversations').select('id', { count: 'exact', head: true }).eq('status', 'handoff'),
  ]);
  if (list.error || waiting.error) throw new AppError(500, 'Could not load support chats');
  return { conversations: list.data ?? [], total: list.count ?? 0, waiting: waiting.count ?? 0, page };
}

export async function getSupportChat(id: string, before?: string) {
  const { data, error } = await supabaseAdmin.from('support_chat_conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw new AppError(500, 'Could not load support chat');
  if (!data) throw new AppError(404, 'Support chat not found');
  let query = supabaseAdmin.from('squad_bot_messages')
    .select('id, sender, body, channel, staff_name, created_at')
    .eq('conversation_id', id).eq('channel', 'app').order('created_at', { ascending: false }).limit(100);
  if (before) query = query.lt('created_at', before);
  const { data: messages, error: messagesError } = await query;
  if (messagesError) throw new AppError(500, 'Could not load support messages');
  return { ...data, messages: (messages ?? []).reverse(), has_more: (messages ?? []).length === 100 };
}

export async function supportAction(id: string, action: 'reply' | 'instruct' | 'takeover' | 'hand-back', actor: { id: string; name: string }, body?: string) {
  await getSupportChat(id); // Reject WhatsApp-only conversations, including guessed IDs.
  if (action === 'hand-back') return bot.handBack(id, actor);
  if (action === 'takeover' || action === 'reply') {
    const { error } = await supabaseAdmin.from('squad_bot_conversations').update({ status: 'handoff' }).eq('id', id);
    if (error) throw new AppError(500, 'Could not pause the bot');
  }
  if (action === 'takeover') {
    await bot.addMessage(id, { sender: 'system', channel: 'app', body: `${actor.name} took over the support chat.`, staff_user_id: actor.id, staff_name: actor.name });
    return { status: 'handoff' };
  }
  // Explicit channel is essential: the latest inbound message may be WhatsApp.
  if (action === 'reply') return bot.staffReply(id, actor, body!, 'app');
  return bot.instructBot(id, actor, body!, 'app');
}
