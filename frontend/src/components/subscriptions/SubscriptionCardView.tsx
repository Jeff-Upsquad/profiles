'use client';

import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SubscriptionCardContent from './SubscriptionCardContent';
import {
  useRespondToSubscriptionCard,
  type SubscriptionCardItem,
} from '@/hooks/useSubscriptionCards';

interface Props {
  item: SubscriptionCardItem;
}

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function SubscriptionCardView({ item }: Props) {
  const respond = useRespondToSubscriptionCard();
  const isPending = item.status === 'pending';
  const isCancelled = item.cancelled_at != null;
  const showActions = isPending && !isCancelled;
  const ctaLabel =
    typeof item.card.content.ctaLabel === 'string' && item.card.content.ctaLabel.trim().length > 0
      ? item.card.content.ctaLabel.trim()
      : 'Accept';

  const brandName = (item.card.content.brand_name as string)?.trim() || (item.card.content.title as string)?.trim() || 'Subscription';
  const tint = tintFor(brandName);

  const handle = (action: 'accept' | 'reject') => {
    respond.mutate({ recipientId: item.id, action });
  };

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 ${isCancelled ? 'opacity-70' : ''}`}>
      {/* Tinted top strip with brand */}
      <div className={`${tint} relative h-20 px-5 flex items-center overflow-hidden`}>
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
            style={{ color: 'var(--tint-icon)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tint-icon)' }}>
              {isPending ? 'New offer' : 'Offer'}
            </p>
            <p className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a] truncate" style={{ maxWidth: '14rem' }}>
              {brandName}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <SubscriptionCardContent content={item.card.content} />

        {/* Action footer */}
        <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#E8E5DE] pt-4">
          {showActions ? (
            <>
              <Button
                variant="ghost" size="sm"
                onClick={() => handle('reject')}
                loading={respond.isPending && respond.variables?.action === 'reject'}
                disabled={respond.isPending}
              >
                Decline
              </Button>
              <button
                type="button"
                onClick={() => handle('accept')}
                disabled={respond.isPending}
                className="btn-iridescent disabled:opacity-50 text-sm py-2 px-3.5"
              >
                {respond.isPending && respond.variables?.action === 'accept' ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Accepting…
                  </>
                ) : (
                  <>
                    {ctaLabel}
                    <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {item.status === 'accepted' && <Badge variant="green">Accepted</Badge>}
              {item.status === 'rejected' && <Badge variant="red">Rejected</Badge>}
              {isCancelled && <Badge variant="gray">Cancelled</Badge>}
            </div>
          )}
        </div>

        {respond.isError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
            </svg>
            Could not save your response. Please try again.
          </p>
        )}
      </div>
    </article>
  );
}
