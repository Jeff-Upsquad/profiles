'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import ShareInviteModal from './ShareInviteModal';
import { formatDate, formatDateTime } from '@/lib/formatDate';

interface Question {
  id: string;
  question_text: string;
  field_type: string;
  is_active: boolean;
  display_order: number;
}

interface Invitation {
  id: string;
  token: string;
  expires_at: string;
  submitted_at: string | null;
  responses: Record<string, string | boolean> | null;
  created_at: string;
}

interface InvitationResponse {
  invitation: Invitation | null;
  url?: string;
}

interface Props {
  leadId: string;
  leadName: string;
  leadPhone: string;
  formType: string;
}

export default function InterviewInvitationSection({
  leadId,
  leadName,
  leadPhone,
  formType,
}: Props) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<{ url: string; message: string } | null>(null);

  const { data, isLoading } = useQuery<InvitationResponse>({
    queryKey: ['interview-invitation', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${leadId}/interview-invitation`);
      return data;
    },
    enabled: !!leadId,
  });

  const { data: questions } = useQuery<Question[]>({
    queryKey: ['interview-questions', formType],
    queryFn: async () => {
      const { data } = await api.get(`/admin/interview-questions`, {
        params: { form_type: formType },
      });
      return data;
    },
    enabled: !!formType,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/admin/leads/${leadId}/interview-invitation`);
      return data as { url: string; share_message: string; invitation: Invitation };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['interview-invitation', leadId] });
      setShareData({ url: result.url, message: result.share_message });
      setShareOpen(true);
      toast.success('Interview link generated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to generate link');
    },
  });

  const invitation = data?.invitation;
  const url = data?.url;

  const activeQuestions = (questions ?? []).filter((q) => q.is_active);
  const questionLookup = new Map((questions ?? []).map((q) => [q.id, q]));

  const openShareExisting = () => {
    if (!url || !invitation) return;
    const message =
      `Hi ${leadName},\n\n` +
      `Thanks for your interest in joining Upsquad. Please answer a few quick questions so we can move to the next step:\n\n` +
      `${url}\n\n` +
      `This link is valid for 7 days.\n` +
      `Know more about us: https://www.upsquadconnect.com`;
    setShareData({ url, message });
    setShareOpen(true);
  };

  const renderStatus = () => {
    if (!invitation) {
      return (
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            No interview link has been shared with this candidate yet.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {activeQuestions.length} question{activeQuestions.length === 1 ? '' : 's'} will be
            asked, based on the current {formType} question set.
          </p>
        </div>
      );
    }

    const expired = new Date(invitation.expires_at).getTime() < Date.now();
    const submitted = !!invitation.submitted_at;

    if (submitted) {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="green">Submitted</Badge>
            <span className="text-gray-500">
              {formatDateTime(invitation.submitted_at)}
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white">
            <dl className="divide-y divide-gray-100">
              {Object.entries(invitation.responses ?? {}).map(([qid, answer]) => {
                const q = questionLookup.get(qid);
                const answerText =
                  typeof answer === 'boolean'
                    ? answer
                      ? 'Confirmed'
                      : 'Not confirmed'
                    : String(answer);
                return (
                  <div key={qid} className="px-4 py-3">
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      {q?.question_text || 'Question (removed)'}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {answerText || '—'}
                    </dd>
                  </div>
                );
              })}
              {Object.keys(invitation.responses ?? {}).length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No responses recorded.
                </div>
              )}
            </dl>
          </div>
        </div>
      );
    }

    if (expired) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="red">Expired</Badge>
            <span className="text-gray-500">
              Link expired {formatDate(invitation.expires_at)}; candidate did not respond.
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="yellow">Pending</Badge>
          <span className="text-gray-500">
            Sent {formatDate(invitation.created_at)} • expires{' '}
            {formatDate(invitation.expires_at)}
          </span>
        </div>
        <Button variant="secondary" size="sm" onClick={openShareExisting}>
          View / Copy Link
        </Button>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              First-Level Interview
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Share a questionnaire to pre-screen before scheduling a call.
            </p>
          </div>
          <Button
            size="sm"
            loading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            disabled={activeQuestions.length === 0}
          >
            {invitation && !invitation.submitted_at ? 'Regenerate Link' : 'Generate Interview Link'}
          </Button>
        </div>

        {activeQuestions.length === 0 && (
          <div className="mb-4 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            No active questions for <span className="font-medium">{formType}</span>. Add questions
            in Forms → Interview Questions before generating a link.
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          renderStatus()
        )}
      </div>

      {shareData && (
        <ShareInviteModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          url={shareData.url}
          shareMessage={shareData.message}
          leadPhone={leadPhone}
        />
      )}
    </>
  );
}
