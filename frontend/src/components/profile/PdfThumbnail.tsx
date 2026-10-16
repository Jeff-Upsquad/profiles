'use client';

import { useEffect, useRef, useState } from 'react';
import { loadPdfJs, PDF_DOCUMENT_OPTIONS } from '@/lib/pdfjs';

interface PdfThumbnailProps {
  /** Server-rendered cover image (preferred). */
  thumbnailUrl?: string | null;
  /** The PDF itself — rendered client-side only when no cover exists yet. */
  pdfUrl: string;
  alt: string;
  className?: string;
}

const RENDER_WIDTH_PX = 480;
// Without a server cover we have to download the whole PDF to draw page 1, so
// limit how many tiles do that at once.
const MAX_CONCURRENT_RENDERS = 2;
let activeRenders = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  activeRenders++;
  try {
    return await fn();
  } finally {
    activeRenders--;
    waiting.shift()?.();
  }
}

// Rendered covers are cached per URL so re-filtering tabs doesn't re-download.
const coverCache = new Map<string, string>();

/**
 * First-page cover for a PDF portfolio item. Uses the server-generated
 * `thumbnail_url` when present, otherwise lazily renders page 1 with pdf.js
 * once the tile scrolls into view.
 */
export default function PdfThumbnail({ thumbnailUrl, pdfUrl, alt, className = '' }: PdfThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [cover, setCover] = useState<string | null>(() => coverCache.get(pdfUrl) ?? null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);

  const useServerCover = !!thumbnailUrl && !imgFailed;

  useEffect(() => {
    if (useServerCover || cover || failed) return;
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [useServerCover, cover, failed]);

  useEffect(() => {
    if (!visible || useServerCover || cover || failed) return;
    let cancelled = false;

    withRenderSlot(async () => {
      if (cancelled) return;
      const pdfjs = await loadPdfJs();
      const pdf = await pdfjs.getDocument({ url: pdfUrl, ...PDF_DOCUMENT_OPTIONS }).promise;
      try {
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: RENDER_WIDTH_PX / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D canvas unavailable');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        coverCache.set(pdfUrl, dataUrl);
        if (!cancelled) setCover(dataUrl);
      } finally {
        void pdf.destroy();
      }
    }).catch((err) => {
      console.warn('[PdfThumbnail] could not render cover', err);
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, useServerCover, cover, failed, pdfUrl]);

  const src = useServerCover ? thumbnailUrl! : cover;

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden bg-gray-100 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => useServerCover && setImgFailed(true)}
          className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gray-50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={!failed ? 'animate-pulse' : undefined}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="line-clamp-2 px-2 text-center text-[11px] font-medium text-gray-500">{alt}</span>
        </div>
      )}
    </div>
  );
}
