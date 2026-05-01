import type { PortfolioItem } from '@/types';
import { legacyProviderDisplayName } from '@/lib/videoEmbed';

interface ThreadsPortfolioCardProps {
  item: PortfolioItem;
  onClick: () => void;
}

const LINK_USES_STATIC_POSTER = (provider?: string | null) =>
  provider !== null && provider !== undefined && provider !== 'dropbox';

export default function ThreadsPortfolioCard({ item, onClick }: ThreadsPortfolioCardProps) {
  const isLinkVideo = item.file_type === 'video' && item.source_type === 'link';
  const showStaticPoster = isLinkVideo && LINK_USES_STATIC_POSTER(item.provider);
  const providerLabel = item.provider
    ? legacyProviderDisplayName(item.provider)
    : undefined;

  return (
    <button
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden bg-gray-100 group focus:outline-none"
    >
      {item.file_type === 'image' && (
        <img
          src={item.file_url}
          alt={item.file_name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      )}
      {item.file_type === 'video' && showStaticPoster && (
        <>
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.file_name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-xs font-semibold tracking-wide text-white/90">
              {providerLabel ?? 'Video'}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
          {providerLabel && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {providerLabel}
            </span>
          )}
        </>
      )}
      {item.file_type === 'video' && !showStaticPoster && (
        <>
          <video
            src={item.file_url}
            preload="metadata"
            muted
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </>
      )}
      {item.file_type === 'pdf' && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="mt-1.5 px-2 text-center text-[11px] font-medium text-[var(--threads-text-secondary)] line-clamp-2">
            {item.file_name}
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
    </button>
  );
}
