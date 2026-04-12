'use client';

interface ThreadsPortfolioTabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ThreadsPortfolioTabBar({ tabs, activeTab, onTabChange }: ThreadsPortfolioTabBarProps) {
  return (
    <div className="sticky top-12 z-40 border-b border-[var(--threads-border)] bg-[var(--threads-bg)]">
      <div className="scrollbar-hide flex overflow-x-auto px-5">
        {tabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`relative whitespace-nowrap px-4 py-3 text-[14px] transition-colors ${
                isActive
                  ? 'font-semibold text-[var(--threads-text-primary)]'
                  : 'font-medium text-[var(--threads-text-secondary)] hover:text-[var(--threads-text-primary)]'
              }`}
            >
              {tab}
              {isActive && (
                <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-[var(--threads-accent)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
