import type { HubBotConfig } from './squadhub-bot.js';

/** Stable across HTTP retries, distinct for each new handoff of a conversation. */
export function handoffEventId(conversationId: string, handoffAt: string): string {
  return `squadhire:handoff:${conversationId}:${new Date(handoffAt).toISOString()}`;
}

export function handoffSourceUrl(adminOrigin: string, conversationId: string): string {
  const url = new URL('/admin/squad-bot', adminOrigin);
  url.searchParams.set('chat', conversationId);
  return url.toString();
}

/** Prefer an enabled, broad conversation job; never attach an unrelated action job. */
export function supportJobId(config: HubBotConfig | null, personId: string | null): string | undefined {
  const jobs = config?.jobs ?? [];
  const matches = jobs.filter((job) => job.kind === 'conversation' &&
    (job.audience === 'any' || job.audience === 'candidates') &&
    (!job.person_ids.length || !!personId && job.person_ids.includes(personId)) &&
    !job.pipeline_id && !job.stage_id);
  return (matches.find((job) => job.enabled) ?? matches[0])?.id;
}

/** Exact source for a handoff in the CRM's app or WhatsApp inbox. */
export function supportSourceUrl(base: string, conversationId: string, channel: 'app' | 'whatsapp', leadId: string | null): string {
  const useWhatsApp = channel === 'whatsapp' && !!leadId;
  const url = new URL(useWhatsApp ? '/app/inbox' : '/app/support-chat', base);
  url.searchParams.set(useWhatsApp ? 'lead' : 'chat', useWhatsApp ? leadId! : conversationId);
  return url.toString();
}
