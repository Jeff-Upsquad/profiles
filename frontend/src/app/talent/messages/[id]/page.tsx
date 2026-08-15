'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ConversationThread from '@/components/conversations/ConversationThread';
import {
  useCancelMeeting,
  useConversation,
  useConversationMessages,
  useProposeMeeting,
  useRespondMeeting,
  useSendConversationMessage,
} from '@/hooks/useConversations';

export default function TalentConversationPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { data: conversation, isLoading } = useConversation('talent', id);
  const { data: messages } = useConversationMessages('talent', id);
  const send = useSendConversationMessage('talent', id);
  const propose = useProposeMeeting('talent', id);
  const respond = useRespondMeeting('talent', id);
  const cancel = useCancelMeeting('talent', id);

  if (isLoading || !conversation) {
    return <div className="h-full min-h-0 flex-1 animate-pulse bg-[#f4f4f4]" />;
  }

  return (
    <ConversationThread
      conversation={conversation}
      messages={messages ?? []}
      selfType="talent"
      selfId={user?.id ?? ''}
      onSend={(body) => send.mutate(body)}
      sending={send.isPending}
      onPropose={(input) => propose.mutate(input)}
      proposing={propose.isPending}
      onRespond={(meetingId, action) => respond.mutate({ meetingId, action })}
      onCancelMeeting={(meetingId) => cancel.mutate(meetingId)}
      meetingBusy={respond.isPending || cancel.isPending}
      backHref="/talent/messages"
    />
  );
}
