'use client';

import Link from 'next/link';
import type { RequestedChange } from '@/types';

interface Props {
  profileId: string;
  changes: RequestedChange[];
  requestedAt?: string | null;
  /** Where this banner sits: the edit page links items to on-page anchors, elsewhere it links to /edit. */
  onEditPage?: boolean;
  /** Renders the "Resubmit for review" button (edit page only). */
  onResubmit?: () => void;
  resubmitting?: boolean;
  resubmitDisabled?: boolean;
  resubmitDisabledReason?: string;
  compact?: boolean;
  staysLive?: boolean;
  /** Overrides the "Unsaved edits are saved first." hint next to Resubmit. */
  resubmitNote?: string;
}

/** Deep-link for one checklist item. `basic.*` → basic profile page, everything else → the job-profile edit page. */
export function changeHref(profileId: string, c: RequestedChange, onEditPage: boolean): string | null {
  if (c.key.startsWith('basic.')) return '/talent/basic-profile';
  if (c.key.startsWith('identity.')) return '/talent/basic-profile';
  const base = onEditPage ? '' : `/talent/profiles/${profileId}/edit`;
  if (c.key.startsWith('field.')) return `${base}#field-${c.key.slice(6)}`;
  if (c.key.startsWith('job.portfolio')) return `${base}#portfolio`;
  if (c.key === 'job.skills') return `${base}#skills`;
  return onEditPage ? null : base;
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Shown while a job profile is in `changes_requested`: the exact list the
 * reviewer ticked, each item linking to where it's fixed, and the resubmit CTA.
 */
export default function RequestedChangesBanner({
  profileId,
  changes,
  requestedAt,
  onEditPage = false,
  onResubmit,
  resubmitting,
  resubmitDisabled,
  resubmitDisabledReason,
  compact = false,
  staysLive = false,
  resubmitNote = 'Unsaved edits are saved first.',
}: Props) {
  if (!changes || changes.length === 0) return null;

  if (compact) {
    return (
      <div className="mt-3 rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 p-2.5 text-xs text-amber-900">
        <span className="font-medium">Updates needed ({changes.length}):</span>{' '}
        {changes.slice(0, 3).map((c) => c.label).join(', ')}
        {changes.length > 3 ? ` +${changes.length - 3} more` : ''}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <svg className="h-4 w-4 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M7 4h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-amber-900">
            Your reviewer asked you to update {changes.length === 1 ? 'one thing' : `${changes.length} things`}
          </h3>
          <p className="mt-0.5 text-xs text-amber-800">
            {requestedAt ? `Requested on ${formatWhen(requestedAt)}. ` : ''}
            Make the updates below, then tap <span className="font-medium">Resubmit for review</span>. Your profile {staysLive ? 'remains live while you make these updates.' : 'stays paused until then.'}
          </p>
          <ol className="mt-3 space-y-1.5">
            {changes.map((c, i) => {
              const href = changeHref(profileId, c, onEditPage);
              const body = (
                <>
                  <span className="font-medium text-amber-950">{c.label}</span>
                  {c.message !== c.label && <span className="text-amber-900"> — {c.message}</span>}
                  {c.note && <span className="text-amber-800"> ({c.note})</span>}
                </>
              );
              return (
                <li key={`${c.key}-${i}`} className="flex items-start gap-2 text-sm">
                  <span className="mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-semibold text-amber-900">
                    {i + 1}
                  </span>
                  {href ? (
                    <Link href={href} className="underline-offset-2 hover:underline">
                      {body}
                    </Link>
                  ) : (
                    <span>{body}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {onResubmit && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onResubmit}
                disabled={resubmitDisabled || resubmitting}
                title={resubmitDisabled ? resubmitDisabledReason : undefined}
                className="btn-iridescent disabled:opacity-50"
              >
                {resubmitting ? 'Resubmitting…' : 'Resubmit for review'}
              </button>
              <span className="text-xs text-amber-800">{resubmitNote}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
