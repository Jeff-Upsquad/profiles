'use client';

import type { DayConsoleInvite } from '@/hooks/useBusinessJobs';
import { fmtTime, initials, tintFor } from '@/components/jobs/shared';

// One candidate card inside a day-console column — seq ticket, approx time,
// timestamps and the caller-supplied action buttons.

export default function CandidateInterviewCard({
  invite,
  actions,
  note,
}: {
  invite: DayConsoleInvite;
  actions?: React.ReactNode;
  note?: string | null;
}) {
  const tint = tintFor(invite.candidate_id);
  return (
    <div className="rounded-xl border border-[#E7E7EA] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5">
        <div
          className={`${tint} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold`}
          style={{ color: 'var(--tint-icon)' }}
        >
          {initials(invite.talent_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#0a0a0a]">
            {invite.talent_name || 'Unknown talent'}
          </p>
          <p className="truncate text-[11px] text-[#a3a3a3]">
            {[
              invite.confirm_seq != null ? `#${invite.confirm_seq}` : null,
              invite.approx_time ? `~${fmtTime(invite.approx_time)}` : null,
              invite.showed_up_at ? `Showed up ${fmtTime(invite.showed_up_at)}` : null,
              invite.started_at ? `Started ${fmtTime(invite.started_at)}` : null,
              invite.outcome ? `Outcome: ${invite.outcome.replace('_', ' ')}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
      </div>
      {note && <p className="mt-1.5 text-[11px] text-[#737373]">{note}</p>}
      {actions && <div className="mt-2 flex flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
  );
}
