'use client';

const JOBS_PILL =
  'inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700';
const PARTNER_PILL =
  'inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700';
const NONE_PILL =
  'inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-400';

/** employment_type values: 'salary' = Jobs, 'partner_program' = Subscriptions, 'freelance' = Assignments. */
export function normalizeEmployment(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [],
  );
}

/**
 * Grouped work-preference badges so it reads at a glance:
 * - whether the talent wants Jobs
 * - whether they joined the Partner Program
 * - and, when they did, whether Subscriptions, Assignments, or both.
 *
 * The old rendering joined per-value labels ("Partner Program · Subscriptions ·
 * Partner Program · Assignments"), repeating the program name once per option.
 */
export default function WorkPreferenceBadges({ employment }: { employment: unknown }) {
  const types = normalizeEmployment(employment);
  if (types.size === 0) {
    return <span className="italic text-gray-400">Not provided</span>;
  }
  const hasJobs = types.has('salary');
  const hasSubs = types.has('partner_program');
  const hasAssign = types.has('freelance');
  const hasPartner = hasSubs || hasAssign;
  const partnerDetail =
    hasSubs && hasAssign
      ? 'Subscriptions + Assignments'
      : hasSubs
        ? 'Subscriptions'
        : 'Assignments';

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {hasJobs ? (
        <span className={JOBS_PILL} title="Looking for jobs">
          Jobs
        </span>
      ) : (
        <span className={NONE_PILL} title="Not looking for jobs">
          No jobs
        </span>
      )}
      {hasPartner ? (
        <span className={PARTNER_PILL} title={`Partner Program: ${partnerDetail}`}>
          Partner Program · {partnerDetail}
        </span>
      ) : (
        <span className={NONE_PILL} title="Not in the Partner Program">
          No Partner Program
        </span>
      )}
    </span>
  );
}
