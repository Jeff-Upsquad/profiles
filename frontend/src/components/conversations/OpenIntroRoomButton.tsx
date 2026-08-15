'use client';

import { useRouter } from 'next/navigation';
import { useOpenConversation } from '@/hooks/useConversations';

export default function OpenIntroRoomButton({
  cardId,
  talentUserId,
  intent = 'message',
  disabled,
  className,
}: {
  cardId: string;
  talentUserId: string;
  intent?: 'message' | 'meet';
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const open = useOpenConversation('business');

  return (
    <button
      type="button"
      disabled={disabled || open.isPending}
      onClick={() => {
        open.mutate(
          { cardId, talentUserId },
          {
            onSuccess: (conversation) => {
              const q = intent === 'meet' ? '?meet=1' : '';
              router.push(`/business/messages/${conversation.id}${q}`);
            },
          },
        );
      }}
      className={
        className ??
        'rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:cursor-not-allowed disabled:opacity-40'
      }
    >
      {open.isPending ? 'Opening…' : intent === 'meet' ? 'Meet' : 'Chatroom'}
    </button>
  );
}
