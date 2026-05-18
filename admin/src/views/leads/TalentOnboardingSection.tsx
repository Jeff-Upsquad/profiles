'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import { cleanPhoneForLink } from '@/lib/phone';

const SIGNUP_URL = 'https://squadhire.upsquadconnect.com/signup/talent';

interface Props {
  leadEmail: string | null;
  leadName: string;
  leadPhone: string;
  leadProfileType: string | null;
  leadProfileTypeCustom: string | null;
  linkedTalent: { id: string; full_name: string } | null;
}

// Phase 1 of the Elite -> Top Talents rename keeps the legacy 'elite' key
// so existing DB rows render with the new label. New writes use 'Top Talents'.
const TIER_LABELS: Record<string, string> = {
  junior: 'Junior',
  pro: 'Pro',
  elite: 'Top Talents',
  'Top Talents': 'Top Talents',
};

function resolveTierName(
  profileType: string | null,
  profileTypeCustom: string | null,
): string | null {
  if (!profileType) return null;
  if (profileType === 'custom') {
    const trimmed = profileTypeCustom?.trim();
    return trimmed || null;
  }
  return TIER_LABELS[profileType] ?? null;
}

export default function TalentOnboardingSection({
  leadEmail,
  leadName,
  leadPhone,
  leadProfileType,
  leadProfileTypeCustom,
  linkedTalent,
}: Props) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const invitationQueryKey = ['invitation-check', leadEmail];
  const { data: existingInvitations = [] } = useQuery<Array<{ status: string }>>({
    queryKey: invitationQueryKey,
    queryFn: async () => {
      const { data } = await api.get('/admin/invitations', {
        params: { email: leadEmail, role: 'talent', status: 'pending' },
      });
      return data.invitations ?? [];
    },
    enabled: !!leadEmail,
    staleTime: 30_000,
  });

  const signedUp = !!linkedTalent;
  const invited = existingInvitations.length > 0;

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!leadEmail) throw new Error('Candidate has no email on file');
      await api.post('/admin/invitations', { email: leadEmail, role: 'talent' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationQueryKey });
      toast.success('Invitation created — they can now sign up');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || '';
      if (err.response?.status === 409 || /already/i.test(msg) || /pending/i.test(msg)) {
        queryClient.invalidateQueries({ queryKey: invitationQueryKey });
        toast('An invitation already exists for this email', { icon: 'ℹ️' });
      } else {
        toast.error(msg || 'Failed to invite');
      }
    },
  });

  const copyLink = () => {
    navigator.clipboard.writeText(SIGNUP_URL);
    setCopied(true);
    toast.success('Signup link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareMessage = () => {
    const firstName = leadName.split(' ')[0] || leadName;
    const tierName = resolveTierName(leadProfileType, leadProfileTypeCustom);
    const congrats = tierName
      ? `Congrats! You've been shortlisted with Upsquad Partner Program under the ${tierName} tier.`
      : `Congrats! You've been shortlisted with Upsquad Partner Program.`;
    return (
      `Hi, ${firstName}.\n\n` +
      `${congrats} To know more about the program, visit our website: https://upsquadconnect.com/partner-program/.\n\n` +
      `After watching the video and going through the website, if you are interested, you can click on the apply button and create your profile; then upload your portfolio.`
    );
  };

  const openWhatsApp = () => {
    const linkPhone = cleanPhoneForLink(leadPhone);
    const msg = encodeURIComponent(shareMessage());
    const href = linkPhone
      ? `https://wa.me/${linkPhone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
            Talent Onboarding
          </h3>
          <p className="mt-1 text-sm text-gray-700">
            Invite this shortlisted candidate to create their talent profile. They&apos;ll sign up
            using their email and complete onboarding.
          </p>
        </div>
      </div>

      {!leadEmail && (
        <p className="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          Candidate has no email on file — add one before inviting.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => inviteMutation.mutate()}
          loading={inviteMutation.isPending}
          disabled={!leadEmail || invited || signedUp}
          className={signedUp || invited ? '!bg-green-600 !text-white hover:!bg-green-600 !cursor-default' : ''}
          title={signedUp ? 'Candidate has already signed up' : invited ? 'Invitation already created for this candidate' : undefined}
        >
          {signedUp ? '✓ Signed up' : invited ? '✓ Invited' : 'Invite as Talent'}
        </Button>

        <button
          type="button"
          onClick={openWhatsApp}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
          title="Opens WhatsApp with a pre-filled message and the partner-program link"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Share on WhatsApp
        </button>

        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          title="Copy the signup URL"
        >
          {copied ? (
            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          {copied ? 'Copied' : 'Copy Link'}
        </button>
      </div>

      <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs">
        <span className="font-medium text-gray-600">Signup URL: </span>
        <code className="break-all text-indigo-700">{SIGNUP_URL}</code>
      </div>
    </section>
  );
}
