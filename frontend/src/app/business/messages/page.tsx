'use client';

import ConversationInbox from '@/components/conversations/ConversationInbox';
import { useConversations } from '@/hooks/useConversations';

export default function BusinessMessagesPage() {
  const { data, isLoading } = useConversations('business');

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="border-b border-[#E7E7EA] px-4 py-3">
        <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.02em] text-[#0a0a0a]">
          Chatroom
        </h1>
      </div>
      {isLoading ? (
        <div className="space-y-0 divide-y divide-[#F0F0F0]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-[#f0f0f0]" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-[#f0f0f0]" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-[#f0f0f0]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ConversationInbox
          conversations={data ?? []}
          hrefFor={(c) => `/business/messages/${c.id}`}
          counterpart="talent"
          empty="No chatrooms yet. Open one from a shortlisted or selected talent."
        />
      )}
    </div>
  );
}
