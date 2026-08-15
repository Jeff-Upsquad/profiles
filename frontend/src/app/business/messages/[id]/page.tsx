'use client';

import { useParams, useSearchParams } from 'next/navigation';
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

export default function BusinessConversationPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = params.id as string;
  const { user } = useAuth();
  const { data: conversation, isLoading } = useConversation('business', id);
  const { data: messages } = useConversationMessages('business', id);
  const send = useSendConversationMessage('business', id);
  const propose = useProposeMeeting('business', id);
  const respond = useRespondMeeting('business', id);
  const cancel = useCancelMeeting('business', id);

  if (isLoading || !conversation) {
    return <div className="h-full min-h-0 flex-1 animate-pulse bg-[#f4f4f4]" />;
  }

  return (
    <ConversationThread
      conversation={conversation}
      messages={messages ?? []}
      selfType="business"
      selfId={user?.id ?? ''}
      onSend={(body) => send.mutate(body)}
      sending={send.isPending}
      onPropose={(input) => propose.mutate(input)}
      proposing={propose.isPending}
      onRespond={(meetingId, action) => respond.mutate({ meetingId, action })}
      onCancelMeeting={(meetingId) => cancel.mutate(meetingId)}
      meetingBusy={respond.isPending || cancel.isPending}
      openMeetOnMount={search.get('meet') === '1'}
      backHref="/business/messages"
    />
  );
}
