'use client';

import ConversationInbox from '@/components/conversations/ConversationInbox';
import { useConversations } from '@/hooks/useConversations';

export default function BusinessMessagesPage() {
  const { data, isLoading } = useConversations('business');

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
          Messages
        </h1>
        <p className="mt-1 text-sm text-[#737373]">
          Intro rooms with shortlisted talent. An UpSquad salesperson is always in the conversation.
        </p>
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      ) : (
        <ConversationInbox
          conversations={data ?? []}
          hrefFor={(c) => `/business/messages/${c.id}`}
          counterpart="talent"
          empty="No conversations yet. Open a room from a shortlisted talent."
        />
      )}
    </div>
  );
}
