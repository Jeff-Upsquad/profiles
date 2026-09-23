'use client';

import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';
import type { OpportunityPreviewItem } from '@/hooks/usePartnerProgram';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

/**
 * A live opportunity shown to someone who is not a partner yet: same card
 * anatomy as the real feed, with the client anonymised and no way to act on it.
 *
 * The anonymising already happened server-side — this component only has safe
 * fields to render. `hideIdentity` is still passed to SubscriptionCardContent
 * so the identity-shaped sections stay collapsed even if a future content key
 * slips through.
 */
export default function PreviewOpportunityCard({ item }: { item: OpportunityPreviewItem }) {
  const tint = tintFor(item.ref);
  const isAssignment = item.card_type === 'assignment';
  const role = (item.content.subscription_name as string)?.trim();

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
      <div className={`${tint} relative flex h-20 items-center overflow-hidden px-5`}>
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
        <div className="relative flex w-full items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
            style={{ color: 'var(--tint-icon)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p
              className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--tint-icon)' }}
            >
              Live opportunity
            </p>
            <p className="truncate font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              {role || 'Confidential client'} · Client {item.ref}
            </p>
          </div>
          <span
            className="relative ml-auto shrink-0 self-start rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm"
            style={{ color: 'var(--tint-icon)' }}
          >
            {isAssignment ? 'Assignment' : 'Subscription'}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <SubscriptionCardContent content={item.content} hideIdentity />

        <div className="mt-auto flex items-center gap-2 border-t border-[#E7E7EA] pt-4">
          <svg className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="font-[family-name:var(--font-inter)] text-[11px] leading-tight text-[#737373]">
            Client details unlock once you join the Partner Program.
          </p>
        </div>
      </div>
    </article>
  );
}
