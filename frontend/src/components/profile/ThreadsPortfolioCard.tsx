import type { PortfolioItem } from '@/types';
import { legacyProviderDisplayName } from '@/lib/videoEmbed';
import PdfThumbnail from './PdfThumbnail';

interface ThreadsPortfolioCardProps {
  item: PortfolioItem;
  onClick: () => void;
}

// Link videos that aren't directly playable (everything except Dropbox direct
// URLs) get a static poster + provider chip in the grid. The actual iframe
// only mounts in the lightbox to keep grid scroll cheap and avoid third-party
// autoplay/cookies on the public profile page.
const LINK_USES_STATIC_POSTER = (provider?: string | null) =>
  provider !== null && provider !== undefined && provider !== 'dropbox';

export default function ThreadsPortfolioCard({ item, onClick }: ThreadsPortfolioCardProps) {
  const isLinkVideo = item.file_type === 'video' && item.source_type === 'link';
  const showStaticPoster = isLinkVideo && LINK_USES_STATIC_POSTER(item.provider);
  // Use legacyProviderDisplayName so historical 'gdrive' rows still get a
  // human label even though we no longer accept new GDrive pastes.
  const providerLabel = item.provider
    ? legacyProviderDisplayName(item.provider)
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${item.file_name}`}
      className={`relative w-[240px] max-w-full overflow-hidden rounded-[10px] bg-zinc-100 group focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 sm:w-[280px] ${
        item.file_type === 'image' ? 'aspect-square' : 'aspect-[4/5]'
      }`}
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
            // eslint-disable-next-line @next/next/no-img-element
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
          {/* Play icon overlay */}
          <span className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </span>
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
          {/* Play icon overlay */}
          <span className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-black/55" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </span>
          {isLinkVideo && providerLabel && (
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {providerLabel}
            </span>
          )}
        </>
      )}
      {item.file_type === 'pdf' && (
        <>
          {/* First-page cover — server-rendered thumbnail_url, or a lazy
              client-side render for items uploaded before covers existed. */}
          <PdfThumbnail
            thumbnailUrl={item.thumbnail_url}
            pdfUrl={item.file_url}
            alt={item.file_name}
          />
          <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            PDF
          </span>
        </>
      )}

      {/* Inactive overlay for talent view (business never receives inactive items) */}
      {item.admin_is_active === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Inactive
          </span>
          {item.admin_comment && (
            <span className="mt-1 max-w-[90%] truncate rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/90">
              {item.admin_comment}
            </span>
          )}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
    </button>
  );
}
