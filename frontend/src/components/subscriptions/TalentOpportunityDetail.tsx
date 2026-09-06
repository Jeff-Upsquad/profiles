'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import AssignmentOfferActions from '@/components/subscriptions/AssignmentOfferActions';
import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';
import { useMySubscriptionCards } from '@/hooks/useSubscriptionCards';
import { useAuth } from '@/context/AuthContext';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export default function TalentOpportunityDetail({
  recipientId,
  type,
}: {
  recipientId: string;
  type: 'subscription' | 'assignment';
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [inApp, setInApp] = useState(false);
  const { data, isLoading, isError } = useMySubscriptionCards('all', type);
  const item = data?.find((row) => row.id === recipientId);

  useEffect(() => {
    try {
      setInApp(sessionStorage.getItem('squadhire_in_app') === '1');
    } catch {
      setInApp(false);
    }
  }, []);

  if (isLoading) return <div className="h-80 animate-pulse rounded-2xl bg-[#ececef]" />;

  if (isError || !item) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-semibold text-[#0a0a0a]">Opportunity not found.</p>
        <button type="button" onClick={() => router.back()} className="mt-3 text-sm text-[#525252] underline underline-offset-2">Go back</button>
      </div>
    );
  }

  const content = item.card.content;
  const brand = text(content.brand_name) || 'Opportunity';
  const role = text(content.subscription_name);
  const plan = text(content.plan_name);
  const serviceType = role || (type === 'assignment' ? 'Assignment' : 'Subscription');
  const tint = tintFor(brand);
  const pending = item.status === 'pending' && !item.cancelled_at;
  const inactive = user?.is_active === false;

  return (
    <div className={pending ? 'space-y-4 pb-48' : 'space-y-4'}>
      <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] hover:text-[#0a0a0a]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to opportunities
      </button>

      <article className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_4px_18px_-8px_rgba(0,0,0,0.12)]">
        <header className={`${tint} relative overflow-hidden px-5 py-5`}>
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/45 blur-3xl" />
          <div className="relative flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm backdrop-blur-sm" style={{ color: 'var(--tint-icon)' }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--tint-icon)' }}>{type}</p>
                <div className="shrink-0">
                  {item.status === 'accepted' && <Badge variant="green">Accepted</Badge>}
                  {item.status === 'rejected' && <Badge variant="red">Declined</Badge>}
                  {item.cancelled_at && <Badge variant="gray">Cancelled</Badge>}
                  {pending && <Badge variant="yellow">Pending</Badge>}
                </div>
              </div>
              <h1 className="mt-1 truncate font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">{brand}</h1>
            </div>
          </div>
          <dl className="relative mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/70 bg-white/65 backdrop-blur-sm">
            <div className="min-w-0 px-3.5 py-3">
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Type</dt>
              <dd className="mt-1 text-sm font-semibold leading-snug text-[#0a0a0a]">{serviceType}</dd>
            </div>
            <div className="min-w-0 border-l border-white px-3.5 py-3">
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Plan name</dt>
              <dd className="mt-1 text-sm font-semibold leading-snug text-[#0a0a0a]">{plan || '—'}</dd>
            </div>
          </dl>
        </header>
        <div className="bg-white p-4 sm:p-5">
          <SubscriptionCardContent content={content} hideIdentity detailLayout />
        </div>
      </article>

      {pending && (
        <div className={`fixed left-4 right-4 z-40 mx-auto max-w-5xl rounded-2xl border border-[#E7E7EA] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.22)] backdrop-blur-sm ${inApp ? 'bottom-3' : 'bottom-[76px] md:bottom-4'}`}>
          {inactive ? (
            <p className="text-center text-sm font-medium text-[#737373]">Your profile is inactive. Contact support to respond.</p>
          ) : (
            <AssignmentOfferActions
              item={item}
              currency={typeof content.currency === 'string' ? content.currency : undefined}
              bidLabel={type === 'subscription'}
              hideAmountSummary
              compactActions
            />
          )}
        </div>
      )}
    </div>
  );
}
