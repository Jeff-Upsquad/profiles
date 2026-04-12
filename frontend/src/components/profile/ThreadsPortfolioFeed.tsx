import type { PortfolioItem } from '@/types';
import ThreadsPortfolioCard from './ThreadsPortfolioCard';

interface ThreadsPortfolioFeedProps {
  items: PortfolioItem[];
  activeTab: string;
  talentName: string;
  avatarUrl?: string;
  isVerified: boolean;
}

export default function ThreadsPortfolioFeed({ items, activeTab, talentName, avatarUrl, isVerified }: ThreadsPortfolioFeedProps) {
  const filtered = activeTab === 'All' ? items : items.filter((i) => i.skill_name === activeTab);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--threads-bg-tag)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--threads-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="mt-3 text-[14px] text-[var(--threads-text-secondary)]">No portfolio items yet</p>
      </div>
    );
  }

  return (
    <div>
      {filtered.map((item) => (
        <ThreadsPortfolioCard
          key={item.id}
          item={item}
          talentName={talentName}
          avatarUrl={avatarUrl}
          isVerified={isVerified}
        />
      ))}
    </div>
  );
}
