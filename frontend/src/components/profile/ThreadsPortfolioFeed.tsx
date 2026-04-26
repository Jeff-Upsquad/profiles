'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { PortfolioItem } from '@/types';
import { legacyProviderDisplayName } from '@/lib/videoEmbed';
import ThreadsPortfolioCard from './ThreadsPortfolioCard';

interface ThreadsPortfolioFeedProps {
  items: PortfolioItem[];
  activeTab: string;
}

// Use the shared display-name helper which gracefully handles legacy
// providers (e.g. 'gdrive') no longer accepted by the parser. Falls back
// to a generic 'source' label when no provider is set.
function providerLabel(provider: string | null | undefined): string {
  return provider ? legacyProviderDisplayName(provider) : 'source';
}

export default function ThreadsPortfolioFeed({ items, activeTab }: ThreadsPortfolioFeedProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageIsTall, setImageIsTall] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = activeTab === 'All' ? items : items.filter((i) => i.skill_name === activeTab);
  const selectedItem = selectedIndex !== null ? filtered[selectedIndex] : null;
  const hasPrev = selectedIndex !== null && selectedIndex > 0;
  const hasNext = selectedIndex !== null && selectedIndex < filtered.length - 1;

  useEffect(() => {
    setImageIsTall(false);
    setShowTopFade(false);
    setShowBottomFade(false);
    setShowScrollHint(false);
  }, [selectedIndex]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const tall = img.naturalHeight / img.naturalWidth > 2;
    setImageIsTall(tall);
    if (tall) {
      setShowBottomFade(true);
      setShowScrollHint(true);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowTopFade(el.scrollTop > 8);
    setShowBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 8);
    if (showScrollHint) setShowScrollHint(false);
  };

  const goNext = useCallback(() => {
    if (hasNext) setSelectedIndex((i) => i! + 1);
  }, [hasNext]);

  const goPrev = useCallback(() => {
    if (hasPrev) setSelectedIndex((i) => i! - 1);
  }, [hasPrev]);

  const close = useCallback(() => setSelectedIndex(null), []);

  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [selectedIndex, goNext, goPrev, close]);

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
    <>
      {/* Portfolio grid — 2 cols mobile, 3 cols desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 mt-0.5 pb-0.5 px-0.5">
        {filtered.map((item, index) => (
          <ThreadsPortfolioCard
            key={item.id}
            item={item}
            onClick={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      {/* Lightbox modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={close}
        >
          {/* Close button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Previous arrow */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Next arrow */}
          {hasNext && (
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Counter */}
          <div className="absolute top-4 left-4 z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90">
            {selectedIndex! + 1} / {filtered.length}
          </div>

          {/* Content */}
          <div
            className="relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedItem.file_type === 'image' && (
              imageIsTall ? (
                <div className="relative rounded-lg overflow-hidden">
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="h-[85vh] w-[min(480px,85vw)] overflow-y-auto overscroll-contain bg-zinc-900"
                  >
                    <img
                      key={selectedItem.id}
                      src={selectedItem.file_url}
                      alt={selectedItem.file_name}
                      onLoad={handleImageLoad}
                      className="block w-full h-auto"
                    />
                  </div>
                  <div
                    className={`pointer-events-none absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-200 ${showTopFade ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div
                    className={`pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-3 transition-opacity duration-200 ${showBottomFade ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {showScrollHint && (
                      <div className="animate-bounce flex h-11 w-11 items-center justify-center rounded-full bg-black/60 shadow-lg">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <img
                  key={selectedItem.id}
                  src={selectedItem.file_url}
                  alt={selectedItem.file_name}
                  onLoad={handleImageLoad}
                  className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
                />
              )
            )}
            {selectedItem.file_type === 'video' &&
              selectedItem.source_type === 'link' &&
              selectedItem.provider !== 'dropbox' &&
              selectedItem.embed_url && (
                <div className="flex flex-col items-center gap-2">
                  <iframe
                    key={selectedItem.id}
                    src={selectedItem.embed_url}
                    title={selectedItem.file_name}
                    // Sandbox blocks top-navigation/forms while still allowing the
                    // provider's player to run. allow-same-origin is required for
                    // YouTube/Vimeo/Loom to function.
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    // Viewport-relative sizing so the iframe adapts to its host:
                    //   – mobile (~360×640): ~324×544, near 9:16, fits portrait video
                    //   – desktop (≥1280): capped at 1200×680, near 16:9, fits landscape
                    // Removed fixed aspect-video (16:9) which letterboxed portrait clips
                    // with huge horizontal black bars.
                    className="h-[85vh] w-[90vw] max-w-[1200px] rounded-lg bg-black"
                  />
                  {selectedItem.external_url && (
                    <a
                      href={selectedItem.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-white/20"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Open in {providerLabel(selectedItem.provider)}
                    </a>
                  )}
                </div>
              )}
            {selectedItem.file_type === 'video' &&
              (selectedItem.source_type !== 'link' || selectedItem.provider === 'dropbox') && (
                <video
                  key={selectedItem.id}
                  src={selectedItem.file_url}
                  controls
                  autoPlay
                  className="max-h-[85vh] max-w-[85vw] rounded-lg"
                />
              )}
            {selectedItem.file_type === 'pdf' && (
              <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-8">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p className="text-sm font-medium text-gray-900">{selectedItem.file_name}</p>
                <a
                  href={selectedItem.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[var(--threads-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Open PDF
                </a>
              </div>
            )}

            {/* File name caption */}
            <p className="mt-3 text-center text-sm text-white/80">
              {selectedItem.file_name}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
