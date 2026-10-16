'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { loadPdfJs, PDF_DOCUMENT_OPTIONS } from '@/lib/pdfjs';

interface PdfViewerProps {
  url: string;
  title: string;
}

interface PageSize {
  width: number;
  height: number;
}

const ZOOM_LEVELS = [1, 1.5, 2, 3];
const PAGE_GAP_PX = 8;
// Cap the backing-store resolution so a 3x-DPR phone at 3x zoom doesn't try to
// allocate a canvas bigger than mobile Safari's per-canvas memory limit.
const MAX_CANVAS_PIXELS = 16_000_000;

/**
 * Scrollable, mobile-friendly PDF viewer. Every page is laid out up front (so
 * the scrollbar is accurate) but only pages near the viewport are painted;
 * pages that scroll far away release their canvas memory again.
 */
export default function PdfViewer({ url, title }: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: PDFDocumentProxy | null = null;
    let destroyTask: (() => void) | null = null;

    setDoc(null);
    setPageSizes([]);
    setError(null);
    setProgress(null);
    setCurrentPage(1);
    setZoomIndex(0);

    loadPdfJs()
      .then(async (pdfjs) => {
        if (cancelled) return;
        const task = pdfjs.getDocument({ url, ...PDF_DOCUMENT_OPTIONS });
        destroyTask = () => { void task.destroy(); };
        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (!cancelled && total > 0) setProgress(Math.min(1, loaded / total));
        };
        const pdf = await task.promise;
        loadedDoc = pdf;
        if (cancelled) { void pdf.destroy(); return; }
        const sizes: PageSize[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          sizes.push({ width: vp.width, height: vp.height });
          if (cancelled) return;
        }
        setPageSizes(sizes);
        setDoc(pdf);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[PdfViewer] failed to load PDF', err);
        setError('This PDF could not be displayed here.');
      });

    return () => {
      cancelled = true;
      if (loadedDoc) void loadedDoc.destroy();
      else destroyTask?.();
    };
  }, [url]);

  // Track the available width so pages fit the container (and re-fit on
  // rotation / window resize).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Focus the scroller so arrow keys / space / PageDown scroll the document.
  useEffect(() => {
    if (doc) scrollRef.current?.focus({ preventScroll: true });
  }, [doc]);

  const zoom = ZOOM_LEVELS[zoomIndex];
  const horizontalPadding = containerWidth < 640 ? 8 : 24;
  const fitWidth = Math.max(0, containerWidth - horizontalPadding * 2);
  const pageCssWidth = Math.floor(fitWidth * zoom);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || pageSizes.length === 0) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    let offset = PAGE_GAP_PX;
    for (let i = 0; i < pageSizes.length; i++) {
      const h = (pageCssWidth / pageSizes[i].width) * pageSizes[i].height;
      if (probe < offset + h + PAGE_GAP_PX) { setCurrentPage(i + 1); return; }
      offset += h + PAGE_GAP_PX;
    }
    setCurrentPage(pageSizes.length);
  }, [pageSizes, pageCssWidth]);

  const changeZoom = (delta: number) => {
    const el = scrollRef.current;
    const next = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, zoomIndex + delta));
    if (next === zoomIndex) return;
    // Keep roughly the same spot in the document after zooming.
    const ratio = el && el.scrollHeight > 0 ? el.scrollTop / el.scrollHeight : 0;
    setZoomIndex(next);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = ratio * el.scrollHeight;
    });
  };

  const isLoading = !doc && !error;

  return (
    <div className="relative flex h-[calc(100dvh-150px)] w-[94vw] max-w-[900px] flex-col overflow-hidden rounded-lg bg-zinc-800 sm:h-[85vh]">
      <div
        ref={scrollRef}
        tabIndex={0}
        onScroll={handleScroll}
        aria-label={title}
        className="flex-1 overflow-auto overscroll-contain outline-none [-webkit-overflow-scrolling:touch]"
      >
        {doc && pageCssWidth > 0 && (
          <div
            className="mx-auto flex flex-col items-center"
            style={{ gap: PAGE_GAP_PX, padding: `${PAGE_GAP_PX}px ${horizontalPadding}px`, width: pageCssWidth + horizontalPadding * 2 }}
          >
            {pageSizes.map((size, i) => (
              <PdfPage
                key={i}
                doc={doc}
                pageNumber={i + 1}
                cssWidth={pageCssWidth}
                cssHeight={Math.round((pageCssWidth / size.width) * size.height)}
                baseWidth={size.width}
                scrollRoot={scrollRef}
              />
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-white/80">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-xs">
              Loading PDF{progress !== null ? ` · ${Math.round(progress * 100)}%` : '…'}
            </p>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-white/80">
            <p className="text-sm">{error}</p>
            <p className="text-xs text-white/60">Use “Open in new tab” below to view it.</p>
          </div>
        )}
      </div>

      {doc && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
            <span className="px-2 tabular-nums">
              {currentPage} / {pageSizes.length}
            </span>
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              onClick={() => changeZoom(-1)}
              disabled={zoomIndex === 0}
              aria-label="Zoom out"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
            <span className="w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => changeZoom(1)}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
              aria-label="Zoom in"
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-40"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  baseWidth: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
}

function PdfPage({ doc, pageNumber, cssWidth, cssHeight, baseWidth, scrollRoot }: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      // Paint a screen and a half ahead so scrolling feels seamless.
      { root: scrollRoot.current, rootMargin: '150% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!nearViewport) {
      // Release backing-store memory for pages far off-screen.
      canvas.width = 0;
      canvas.height = 0;
      setRendered(false);
      return;
    }

    let cancelled = false;
    let task: RenderTask | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        if (cssWidth * cssHeight * pixelRatio * pixelRatio > MAX_CANVAS_PIXELS) {
          pixelRatio = Math.sqrt(MAX_CANVAS_PIXELS / (cssWidth * cssHeight));
        }
        const viewport = page.getViewport({ scale: (cssWidth / baseWidth) * pixelRatio });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        task = page.render({ canvas, canvasContext: ctx, viewport });
        await task.promise;
        if (!cancelled) setRendered(true);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error(`[PdfViewer] failed to render page ${pageNumber}`, err);
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, cssWidth, cssHeight, baseWidth, nearViewport]);

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0 overflow-hidden bg-white shadow-md"
      style={{ width: cssWidth, height: cssHeight }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-500" />
        </div>
      )}
    </div>
  );
}
