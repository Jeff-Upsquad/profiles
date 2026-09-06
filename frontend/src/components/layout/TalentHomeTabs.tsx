'use client';

import { useUnreadSubscriptionCount, useUnreadAssignmentCount } from '@/hooks/useSubscriptionCards';
import { useUnreadJobsCount } from '@/hooks/useJobs';

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
  const { data: unreadSubs = 0 } = useUnreadSubscriptionCount();
  const { data: unreadAssignments = 0 } = useUnreadAssignmentCount();
  const { data: unreadJobs = 0 } = useUnreadJobsCount();

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
