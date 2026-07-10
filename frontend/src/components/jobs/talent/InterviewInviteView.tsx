'use client';

import { useRouter } from 'next/navigation';
import InterviewInviteCard from './InterviewInviteCard';
import { useMyInterviewInvites } from '@/hooks/useJobInterviews';

// Standalone interview-invite page: back button + the shared invite card
// (which handles RSVP + the live queue panel).

export default function InterviewInviteView({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const { data: allInvites } = useMyInterviewInvites();
  const job = (allInvites ?? []).find((i) => i.invite.id === inviteId)?.job ?? null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <InterviewInviteCard inviteId={inviteId} job={job} />
    </div>
  );
}
