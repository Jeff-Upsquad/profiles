'use client';

import Badge from '@/components/ui/Badge';
import type { JobCandidateForBusiness } from '@/hooks/useBusinessJobs';
import {
  FUNNEL_STAGE_LABELS,
  fmtDate,
  funnelStageBadgeVariant,
  initials,
  tintFor,
} from '@/components/jobs/shared';

// One candidate row in the business funnel lists — avatar, name, stage,
// caller-supplied action buttons.

export default function CandidateRow({
  candidate,
  actions,
  subtitle,
}: {
  candidate: JobCandidateForBusiness;
  actions?: React.ReactNode;
  subtitle?: string | null;
}) {
  const tint = tintFor(candidate.id);
  return (
    <div className="flex items-center gap-4 px-5 py-3 sm:px-6">
      <div
        className={`${tint} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-[family-name:var(--font-jakarta)] text-sm font-semibold`}
        style={{ color: 'var(--tint-icon)' }}
      >
        {initials(candidate.talent_name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
            {candidate.talent_name || 'Unknown talent'}
          </p>
          <Badge variant={funnelStageBadgeVariant(candidate.funnel_stage)}>
            {FUNNEL_STAGE_LABELS[candidate.funnel_stage] ?? candidate.funnel_stage}
          </Badge>
        </div>
        <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3]">
          {subtitle ??
            `${FUNNEL_STAGE_LABELS[candidate.funnel_stage] ?? candidate.funnel_stage} since ${fmtDate(candidate.stage_changed_at)}`}
          {candidate.rejected_reason ? ` · ${candidate.rejected_reason}` : ''}
          {candidate.joining_date ? ` · Joining ${fmtDate(candidate.joining_date)}` : ''}
        </p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  );
}
