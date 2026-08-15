import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import type {
  IntroConversationDetail,
  IntroConversationSummary,
  IntroMessage,
  IntroMeetingProvider,
} from '../../../shared/src/types/conversations';

type Role = 'business' | 'talent';

function base(role: Role) {
  return role === 'business' ? '/business/conversations' : '/talent/conversations';
}

export function useConversations(role: Role, enabled = true) {
  return useQuery<IntroConversationSummary[]>({
    queryKey: ['conversations', role, 'list'],
    queryFn: async () => {
      const { data } = await api.get(`${base(role)}`);
      return data.conversations ?? [];
    },
    enabled,
    refetchInterval: 20_000,
  });
}

export function useConversationUnread(role: Role, opts: { enabled?: boolean } = {}) {
  return useQuery<number>({
    queryKey: ['conversations', role, 'unread'],
    queryFn: async () => {
      const { data } = await api.get(`${base(role)}/unread-count`);
      return data.unread ?? 0;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: opts.enabled ?? true,
  });
}

export function useConversation(role: Role, id: string | undefined) {
  return useQuery<IntroConversationDetail>({
    queryKey: ['conversations', role, 'detail', id],
    queryFn: async () => {
      const { data } = await api.get(`${base(role)}/${id}`);
      return data.conversation;
    },
    enabled: !!id,
  });
}

export function useConversationMessages(role: Role, id: string | undefined) {
  return useQuery<IntroMessage[]>({
    queryKey: ['conversations', role, 'messages', id],
    queryFn: async () => {
      const { data } = await api.get(`${base(role)}/${id}/messages`, { params: { limit: 100 } });
      return data.messages ?? [];
    },
    enabled: !!id,
    refetchInterval: 4_000,
  });
}

export function useOpenConversation(role: Role) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cardId: string; talentUserId: string }) => {
      const { data } = await api.post(`${base(role)}`, input);
      return data.conversation as IntroConversationDetail;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', role] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not open the conversation');
    },
  });
}

export function useSendConversationMessage(role: Role, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.post(`${base(role)}/${id}/messages`, { body });
      return data.message as IntroMessage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', role, 'messages', id] });
      qc.invalidateQueries({ queryKey: ['conversations', role] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Message failed to send');
    },
  });
}

export function useProposeMeeting(role: Role, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      starts_at: string;
      ends_at?: string;
      timezone?: string;
      provider: IntroMeetingProvider;
      meeting_link: string;
    }) => {
      const { data } = await api.post(`${base(role)}/${id}/meetings`, input);
      return data.message as IntroMessage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', role, 'messages', id] });
      qc.invalidateQueries({ queryKey: ['conversations', role] });
      toast.success('Meeting proposed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not propose the meeting');
    },
  });
}

export function useRespondMeeting(role: Role, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { meetingId: string; action: 'accept' | 'decline' }) => {
      const { data } = await api.post(
        `${base(role)}/${conversationId}/meetings/${input.meetingId}/respond`,
        { action: input.action },
      );
      return data.meeting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', role, 'messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations', role] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not update the meeting');
    },
  });
}

export function useCancelMeeting(role: Role, conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => {
      const { data } = await api.post(`${base(role)}/${conversationId}/meetings/${meetingId}/cancel`);
      return data.meeting;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations', role, 'messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations', role] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not cancel the meeting');
    },
  });
}
