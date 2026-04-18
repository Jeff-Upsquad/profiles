'use client';

interface ThreadsPortfolioTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ThreadsPortfolioTabBar({ tabs, activeTab, onTabChange }: ThreadsPortfolioTabBarProps) {
  return (
    <div className="flex w-full mt-8 border-b border-zinc-200 px-6">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 pb-3 text-[14px] font-semibold transition-colors relative flex justify-center ${
              isActive
                ? 'text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <span className="truncate px-1 sm:px-2">{tab}</span>
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-950" />
            )}
          </button>
        );
      })}
    </div>
  );
}
