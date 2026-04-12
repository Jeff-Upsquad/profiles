import type { PortfolioItem } from '@/types';

interface ThreadsPortfolioCardProps {
  item: PortfolioItem;
  talentName: string;
  avatarUrl?: string;
  isVerified: boolean;
}

export default function ThreadsPortfolioCard({ item, talentName, avatarUrl, isVerified }: ThreadsPortfolioCardProps) {
  return (
    <div className="border-b border-[var(--threads-border-light)] px-5 py-4 transition-colors hover:bg-[var(--threads-bg-hover)]">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 flex-shrink-0">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
            {avatarUrl ? (
              <img src={avatarUrl} alt={talentName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-200 text-sm font-semibold text-gray-500">
                {talentName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {isVerified && (
            <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--threads-accent-green)] ring-[1.5px] ring-white">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-semibold text-[var(--threads-text-primary)] truncate">
            {talentName}
          </span>
          <span className="rounded-full bg-[var(--threads-bg-tag)] px-2 py-0.5 text-[11px] font-medium text-[var(--threads-text-secondary)]">
            {item.skill_name}
          </span>
        </div>
      </div>

      {/* Body (indented under avatar) */}
      <div className="ml-[52px] mt-2.5">
        {/* Title */}
        <p className="text-[15px] font-medium text-[var(--threads-text-primary)]">
          {item.file_name.replace(/\.[^/.]+$/, '')}
        </p>

        {/* File preview */}
        <div className="mt-2.5">
          {item.file_type === 'image' && (
            <a href={item.file_url} target="_blank" rel="noopener noreferrer">
              <img
                src={item.file_url}
                alt={item.file_name}
                loading="lazy"
                className="w-full rounded-[10px] border border-[var(--threads-border-light)] object-cover"
                style={{ maxHeight: '300px' }}
              />
            </a>
          )}
          {item.file_type === 'video' && (
            <video
              src={item.file_url}
              controls
              preload="metadata"
              className="w-full rounded-[10px] border border-[var(--threads-border-light)]"
              style={{ maxHeight: '300px' }}
            />
          )}
          {item.file_type === 'pdf' && (
            <a
              href={item.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-[10px] border border-[var(--threads-border-light)] p-4 transition-colors hover:bg-[var(--threads-bg-tag)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[var(--threads-text-primary)]">{item.file_name}</p>
                <p className="text-[12px] text-[var(--threads-text-secondary)]">PDF Document</p>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
