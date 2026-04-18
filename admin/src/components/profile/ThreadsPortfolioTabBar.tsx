'use client';

interface ThreadsPortfolioTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ThreadsPortfolioTabBar({ tabs, activeTab, onTabChange }: ThreadsPortfolioTabBarProps) {
  return (
    <div className="flex w-full mt-8 border-b border-zinc-200 px-6 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-shrink-0 pb-3 px-4 text-[14px] font-semibold transition-colors relative flex justify-center ${
              isActive
                ? 'text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <span className="whitespace-nowrap">{tab}</span>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-950" />
            )}
          </button>
        );
      })}
    </div>
  );
}
