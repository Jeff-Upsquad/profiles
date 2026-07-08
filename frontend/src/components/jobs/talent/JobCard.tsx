'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useRespondToJob, type TalentJobFeedItem } from '@/hooks/useJobs';
import {
  FUNNEL_STAGE_LABELS,
  fmtDate,
  funnelStageBadgeVariant,
  jobBusinessName,
  jobLocationLabel,
  jobTitle,
  packageLabel,
  tintFor,
} from '@/components/jobs/shared';

// One job-opening card in the talent feed. 'new' items carry Apply/Decline;
// funnel items show their stage badge. Everything links into the detail page.

export default function JobCard({ item }: { item: TalentJobFeedItem }) {
  const respond = useRespondToJob();
  const content = item.card?.content ?? {};
  const title = jobTitle(content);
  const businessName = jobBusinessName(content);
  const tint = tintFor(businessName);
  const pkg = packageLabel(content);
  const location = jobLocationLabel(content);
  const workMode = content.job_profile?.work_mode ?? null;
  const employmentType = content.job_profile?.employment_type ?? null;
  const isNew = item.funnel_stage == null;
  const detailHref = item.recipient_id ? `/talent/job-openings/${item.recipient_id}` : null;

  const handle = (action: 'accept' | 'reject') => {
    if (!item.recipient_id) return;
    respond.mutate({ recipientId: item.recipient_id, action });
  };

  const body = (
    <>
      {/* Tinted top strip with the business */}
      <div className={`${tint} relative flex h-20 items-center overflow-hidden px-5`}>
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
        <div className="relative flex w-full items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
            style={{ color: 'var(--tint-icon)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tint-icon)' }}>
              {isNew ? 'New opening' : 'Job opening'}
            </p>
            <p className="truncate font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]" style={{ maxWidth: '14rem' }}>
              {businessName}
            </p>
          </div>
          {item.funnel_stage && (
            <span className="ml-auto shrink-0 self-start">
              <Badge variant={funnelStageBadgeVariant(item.funnel_stage)}>
                {FUNNEL_STAGE_LABELS[item.funnel_stage] ?? item.funnel_stage}
              </Badge>
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
            {title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-[#737373]">
            {[employmentType, workMode, location].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {pkg && (
            <span className="rounded-full bg-[#FFFAC2] px-2.5 py-0.5 text-[11px] font-semibold text-[#0a0a0a]">
              {pkg}
            </span>
          )}
          {content.expected_joining_date && (
            <span className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]">
              Join by {fmtDate(content.expected_joining_date)}
            </span>
          )}
          {content.openings_count != null && content.openings_count > 1 && (
            <span className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]">
              {content.openings_count} openings
            </span>
          )}
        </div>

        {typeof content.description === 'string' && content.description && (
          <p className="line-clamp-3 text-sm text-[#525252]">{content.description}</p>
        )}

        {/* Action footer */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#E7E7EA] pt-4">
          {detailHref ? (
            <Link
              href={detailHref}
              className="text-xs font-semibold text-[#0a0a0a] underline-offset-2 hover:underline"
            >
              View details
            </Link>
          ) : (
            <span />
          )}
          {isNew && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handle('reject')}
                loading={respond.isPending && respond.variables?.action === 'reject'}
                disabled={respond.isPending}
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => handle('accept')}
                loading={respond.isPending && respond.variables?.action === 'accept'}
                disabled={respond.isPending}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
      {body}
    </article>
  );
}
