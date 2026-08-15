'use client';

import ConversationInbox from '@/components/conversations/ConversationInbox';
import { useConversations } from '@/hooks/useConversations';

export default function TalentMessagesPage() {
  const { data, isLoading } = useConversations('talent');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
          Messages
        </h1>
        <p className="mt-1 text-sm text-[#737373]">
          Intro rooms with businesses. An UpSquad teammate is always in the conversation.
        </p>
      </div>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      ) : (
        <ConversationInbox
          conversations={data ?? []}
          hrefFor={(c) => `/talent/messages/${c.id}`}
          counterpart="business"
          empty="No conversations yet. A business will reach out after they shortlist you."
        />
      )}
    </div>
  );
}
