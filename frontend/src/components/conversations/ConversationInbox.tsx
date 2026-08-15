'use client';

import Link from 'next/link';
import type { IntroConversationSummary, IntroPerson } from '../../../../shared/src/types/conversations';

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

function Avatar({ person }: { person: IntroPerson }) {
  if (person.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.photo_url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFEFEF] text-[15px] font-semibold text-[#0a0a0a]">
      {(person.name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
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
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F0F0]">
          <svg className="h-5 w-5 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <p className="max-w-xs text-sm text-[#737373]">{empty}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#F0F0F0] bg-white">
      {conversations.map((c) => {
        const person = counterpart === 'talent' ? c.talent : c.business;
        const unread = c.unread_count > 0;
        return (
          <li key={c.id}>
            <Link
              href={hrefFor(c)}
              className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-[#F5F5F6] hover:bg-[#FAFAF8]"
            >
              <Avatar person={person} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={`truncate font-[family-name:var(--font-jakarta)] text-[15px] ${
                      unread ? 'font-semibold text-[#0a0a0a]' : 'font-medium text-[#0a0a0a]'
                    }`}
                  >
                    {person.name}
                  </p>
                  <span className={`shrink-0 text-[11px] ${unread ? 'font-medium text-[#0a0a0a]' : 'text-[#a3a3a3]'}`}>
                    {when(c.last_message_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-[13px] ${unread ? 'font-medium text-[#262626]' : 'text-[#737373]'}`}>
                    {preview(c)}
                  </p>
                  {unread && (
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold text-white">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                {c.card_title && (
                  <p className="mt-0.5 truncate text-[11px] text-[#a3a3a3]">{c.card_title}</p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
