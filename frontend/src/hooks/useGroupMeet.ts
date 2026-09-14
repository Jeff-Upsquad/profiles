import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import type { GroupMeet, GroupMeetJoinCredentials } from '../../../shared/src/types/group-meet';

export interface GroupMeetScheduleInput {
  title?: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
}

export async function joinGroupMeet(meetingId: string, role: 'business' | 'talent') {
  const { data } = await api.post<{ credentials: GroupMeetJoinCredentials }>(`/${role}/group-meets/${meetingId}/join`);
  return data.credentials;
}

export async function leaveGroupMeet(meetingId: string, role: 'business' | 'talent') {
  await api.post(`/${role}/group-meets/${meetingId}/leave`);
}

export async function refreshGroupMeet(meetingId: string, cardId: string, role: 'business' | 'talent') {
  const path = role === 'business'
    ? `/business/my-subscription-cards/${cardId}/group-meet`
    : `/talent/group-meets/${meetingId}`;
  return (await api.get<{ meeting: GroupMeet }>(path)).data.meeting;
}

export async function sendGroupMeetMessage(meetingId: string, role: 'business' | 'talent', body: string) {
  return (await api.post(`/${role}/group-meets/${meetingId}/messages`, { body })).data.message;
}

export async function respondToGroupMeet(meetingId: string, action: 'accept' | 'decline') {
  return (await api.post<{ meeting: GroupMeet }>(`/talent/group-meets/${meetingId}/respond`, { action })).data.meeting;
}

export function useGroupMeet(cardId: string, enabled = true) {
  return useQuery<GroupMeet | null>({
    queryKey: ['group-meet', cardId],
    queryFn: async () => (await api.get(`/business/my-subscription-cards/${cardId}/group-meet`)).data.meeting,
    enabled: enabled && !!cardId,
  });
}

export function useScheduleGroupMeet(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GroupMeetScheduleInput) => (await api.post(`/business/my-subscription-cards/${cardId}/group-meet`, input)).data.meeting as GroupMeet,
    onSuccess: (meeting) => {
      queryClient.setQueryData(['group-meet', cardId], meeting);
      toast.success(`Invites sent to ${meeting.invited_count} talents`);
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Could not schedule Group Meet'),
  });
}

export function useRescheduleGroupMeet(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, input }: { meetingId: string; input: GroupMeetScheduleInput }) => (await api.put(`/business/group-meets/${meetingId}`, input)).data.meeting as GroupMeet,
    onSuccess: (meeting) => {
      queryClient.setQueryData(['group-meet', cardId], meeting);
      toast.success('New time sent to everyone');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Could not reschedule Group Meet'),
  });
}

export function useCancelGroupMeet(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (meetingId: string) => (await api.post(`/business/group-meets/${meetingId}/cancel`)).data.meeting as GroupMeet,
    onSuccess: (meeting) => {
      queryClient.setQueryData(['group-meet', cardId], meeting);
      toast.success('Group Meet cancelled');
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Could not cancel Group Meet'),
  });
}

export function useSendGroupMeetMessage(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ meetingId, body }: { meetingId: string; body: string }) => (await api.post(`/business/group-meets/${meetingId}/messages`, { body })).data.message,
    onSuccess: (message) => queryClient.setQueryData(['group-meet', cardId], (current: GroupMeet | null | undefined) => current ? { ...current, messages: [...current.messages, message] } : current),
    onError: () => toast.error('Could not send message'),
  });
}
