'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import AssignmentOfferActions from '@/components/subscriptions/AssignmentOfferActions';
import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';
import { useMySubscriptionCards } from '@/hooks/useSubscriptionCards';
import { useAuth } from '@/context/AuthContext';

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
  const brand = typeof content.brand_name === 'string' && content.brand_name.trim() ? content.brand_name.trim() : 'Opportunity';
  const pending = item.status === 'pending' && !item.cancelled_at;
  const inactive = user?.is_active === false;

  return (
    <div className={pending ? 'space-y-4 pb-28' : 'space-y-4'}>
      <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] hover:text-[#0a0a0a]">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to opportunities
      </button>

      <article className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <header className="flex items-start justify-between gap-3 border-b border-[#E7E7EA] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">{type}</p>
            <h1 className="mt-1 truncate font-[family-name:var(--font-jakarta)] text-xl font-semibold text-[#0a0a0a]">{brand}</h1>
          </div>
          {item.status === 'accepted' && <Badge variant="green">Accepted</Badge>}
          {item.status === 'rejected' && <Badge variant="red">Declined</Badge>}
          {item.cancelled_at && <Badge variant="gray">Cancelled</Badge>}
          {pending && <Badge variant="yellow">Pending</Badge>}
        </header>
        <div className="p-5"><SubscriptionCardContent content={content} /></div>
      </article>

      {pending && (
        <div className={`fixed left-4 right-4 z-40 mx-auto max-w-5xl rounded-2xl border border-[#E7E7EA] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.22)] backdrop-blur-sm ${inApp ? 'bottom-3' : 'bottom-[76px] md:bottom-4'}`}>
          {inactive ? (
            <p className="text-center text-sm font-medium text-[#737373]">Your profile is inactive. Contact support to respond.</p>
          ) : (
            <AssignmentOfferActions item={item} currency={typeof content.currency === 'string' ? content.currency : undefined} bidLabel={type === 'subscription'} />
          )}
        </div>
      )}
    </div>
  );
}
