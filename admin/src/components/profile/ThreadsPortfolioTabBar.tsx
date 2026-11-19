'use client';

interface ThreadsPortfolioTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ThreadsPortfolioTabBar({ tabs, activeTab, onTabChange }: ThreadsPortfolioTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Portfolio filter"
      className="mt-4 flex w-full overflow-x-auto border-b border-zinc-200 scrollbar-hide sm:mt-5"
    >
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab)}
            className={`h-[46px] shrink-0 whitespace-nowrap px-4 text-[15px] font-semibold transition-colors sm:h-12 sm:flex-1 sm:px-[18px] ${
              isActive
                ? 'text-zinc-950 shadow-[inset_0_-1px_0_#0a0a0a]'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
