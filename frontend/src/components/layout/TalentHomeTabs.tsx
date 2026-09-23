'use client';

import { useUnreadSubscriptionCount, useUnreadAssignmentCount } from '@/hooks/useSubscriptionCards';
import { useUnreadJobsCount } from '@/hooks/useJobs';
import { usePartnerAccess } from '@/hooks/usePartnerProgram';

export type TalentHomeTab = 'subscriptions' | 'assignments' | 'jobs';

const TABS: { key: TalentHomeTab; label: string }[] = [
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'jobs', label: 'Jobs' },
];

export default function TalentHomeTabs({
  active,
  onChange,
  tabs = TABS.map((tab) => tab.key),
}: {
  active: TalentHomeTab;
  onChange: (tab: TalentHomeTab) => void;
  tabs?: TalentHomeTab[];
}) {
  // Non-partners see the Subscriptions / Assignments tabs as a read-only
  // preview, and the unread endpoints behind these badges are partner-gated —
  // so skip the calls (there is nothing pending for them to count anyway).
  const { approved } = usePartnerAccess();
  const { data: unreadSubs = 0 } = useUnreadSubscriptionCount({ enabled: approved && tabs.includes('subscriptions') });
  const { data: unreadAssignments = 0 } = useUnreadAssignmentCount({ enabled: approved && tabs.includes('assignments') });
  const { data: unreadJobs = 0 } = useUnreadJobsCount({ enabled: tabs.includes('jobs') });

  const badgeFor = (key: TalentHomeTab) => {
    if (key === 'subscriptions') return unreadSubs;
    if (key === 'assignments') return unreadAssignments;
    return unreadJobs;
  };

  return (
    <div className="flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-1.5" role="tablist" aria-label="Home sections">
      {TABS.filter((tab) => tabs.includes(tab.key)).map((t) => {
        const isActive = active === t.key;
        const count = badgeFor(t.key);
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className={`font-[family-name:var(--font-inter)] flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 md:px-5 md:text-[14px] ${
              isActive
                ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]'
                : 'text-[#525252] hover:text-[#0a0a0a]'
            }`}
          >
            <span>{t.label}</span>
            {/* Read-only for non-partners — say so on the tab itself. */}
            {!approved && t.key !== 'jobs' && (
              <svg
                className="h-3.5 w-3.5 shrink-0 text-[#a3a3a3]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-label="Preview only"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {count > 0 && (
              <span
                className={`inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold md:h-5 md:min-w-5 md:px-1.5 md:text-[11px] ${
                  isActive ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#E7E7EA] text-[#525252]'
                }`}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
