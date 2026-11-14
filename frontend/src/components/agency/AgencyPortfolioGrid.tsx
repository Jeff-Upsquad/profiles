'use client';

import { useState, useEffect, useRef } from 'react';

export default function AgencyPortfolioGrid({ items, onMemberClick }: { items: any[]; onMemberClick: (memberId: string) => void }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;

  useEffect(() => {
    if (selectedIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedIndex(null);
      if (event.key === 'ArrowLeft') { event.preventDefault(); setSelectedIndex(index => Math.max(0, index! - 1)); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setSelectedIndex(index => Math.min(items.length - 1, index! + 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); };
  }, [selectedIndex, items.length]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 mt-0.5 pb-0.5 px-0.5 bg-white">
        {items.map((item: any, idx: number) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Open ${item.file_name || 'portfolio item'}`}
            onClick={() => setSelectedIndex(idx)}
            className="group relative aspect-square overflow-hidden bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <PortfolioThumbnail item={item} />
            {item.file_type === 'video' && <span aria-hidden="true" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3l15 9-15 9V3z" /></svg></span>}
            {/* Member attribution badge */}
            {item.member_name && (
              <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{item.member_name}</span>
            )}
            {item.category_name && (
              <span className="absolute top-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-[#0a0a0a]">{item.category_name}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedItem && (
        <div role="dialog" aria-modal="true" aria-label={selectedItem.file_name || 'Portfolio item'} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setSelectedIndex(null)}>
          <button
            aria-label="Close portfolio item"
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {selectedIndex! > 0 && (
            <button aria-label="Previous portfolio item" onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex! - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          {selectedIndex! < items.length - 1 && (
            <button aria-label="Next portfolio item" onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex! + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
          <div className="absolute top-4 left-4 z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90">{selectedIndex! + 1} / {items.length}</div>
          <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {selectedItem.file_type === 'image' && selectedItem.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedItem.file_url} alt={selectedItem.file_name} className="max-h-[75vh] max-w-[85vw] rounded-lg object-contain" />
            ) : selectedItem.embed_url && selectedItem.provider !== 'dropbox' ? (
              <iframe key={selectedItem.id} src={selectedItem.embed_url} title={selectedItem.file_name} sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerPolicy="strict-origin-when-cross-origin" className="h-[75vh] w-[90vw] max-w-[900px] rounded-lg bg-black" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            ) : selectedItem.file_type === 'video' && selectedItem.file_url ? (
              <video key={selectedItem.id} src={selectedItem.file_url} controls autoPlay playsInline className="max-h-[75vh] max-w-[85vw] rounded-lg" />
            ) : (
              <div className="rounded-lg bg-white p-8 text-sm text-zinc-700">{selectedItem.file_name || 'Portfolio item'}</div>
            )}
            {/* Member attribution in lightbox */}
            {selectedItem.member_name && selectedItem.member_id && (
              <button
                onClick={() => {
                  setSelectedIndex(null);
                  onMemberClick(selectedItem.member_id);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#FFFAC2] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {selectedItem.member_photo_url && <img src={selectedItem.member_photo_url} alt={selectedItem.member_name} className="h-6 w-6 rounded-full object-cover" />}
                <span>{selectedItem.member_name}</span>
                <svg className="h-3.5 w-3.5 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            <p className="mt-2 max-w-[85vw] break-all text-center text-sm text-white/80">{selectedItem.file_name || ''}</p>
          </div>
        </div>
      )}
    </>
  );
}

// Only load video metadata near the viewport; portfolios can contain dozens of clips.
function PortfolioThumbnail({ item }: { item: any }) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const image = item.file_type === 'image' ? item.file_url : item.thumbnail_url;
  const directVideo = item.file_type === 'video' && item.file_url && (!item.embed_url || item.provider === 'dropbox');
  return (
    <div ref={container} className="h-full w-full">
      {image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={item.file_name || 'Portfolio preview'} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : directVideo && visible && !videoFailed ? (
        <video src={`${item.file_url}${item.file_url.includes('#') ? '' : '#t=0.1'}`} preload="metadata" muted playsInline onError={() => setVideoFailed(true)} className="pointer-events-none h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 px-4 text-white"><span className="line-clamp-2 break-all text-xs">{item.file_name || 'Video'}</span></div>
      )}
    </div>
  );
}
