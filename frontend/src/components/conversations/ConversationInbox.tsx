'use client';

import Link from 'next/link';
import type { IntroConversationSummary } from '../../../../shared/src/types/conversations';

function preview(c: IntroConversationSummary): string {
  if (!c.last_message) return 'No messages yet';
  if (c.last_message.kind === 'meeting') return 'Meeting update';
  if (c.last_message.kind === 'system') return c.last_message.body || 'Update';
  return c.last_message.body || 'New message';
}

function when(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ConversationInbox({
  conversations,
  hrefFor,
  counterpart,
  empty,
}: {
  conversations: IntroConversationSummary[];
  hrefFor: (c: IntroConversationSummary) => string;
  counterpart: 'talent' | 'business';
  empty: string;
}) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white px-6 py-14 text-center">
        <p className="text-sm text-[#737373]">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {conversations.map((c) => {
        const name = counterpart === 'talent' ? c.talent.name : c.business.name;
        return (
          <li key={c.id} className="border-b border-[#E7E7EA] last:border-b-0">
            <Link
              href={hrefFor(c)}
              className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAF8]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F6] text-sm font-semibold text-[#0a0a0a]">
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                    {name}
                  </p>
                  <span className="shrink-0 text-[11px] text-[#a3a3a3]">{when(c.last_message_at)}</span>
                </div>
                <p className="truncate text-xs text-[#737373]">
                  {c.card_title ?? 'Intro room'}
                  {c.salesperson ? ` · ${c.salesperson.name}` : ' · UpSquad joining'}
                </p>
                <p className={`mt-0.5 truncate text-sm ${c.unread_count > 0 ? 'font-medium text-[#0a0a0a]' : 'text-[#525252]'}`}>
                  {preview(c)}
                </p>
              </div>
              {c.unread_count > 0 && (
                <span className="mt-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold text-white">
                  {c.unread_count}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
