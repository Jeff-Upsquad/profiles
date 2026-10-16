import path from 'node:path';
import { createRequire } from 'node:module';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { uploadFile } from './storage.service.js';

/**
 * Server-side cover thumbnails for uploaded portfolio PDFs.
 *
 * When a talent (or agency) uploads a PDF portfolio item we render its first
 * page to a JPEG, store it next to the PDF on R2 and save the URL in the
 * row's `thumbnail_url`. Public profile grids then show a real cover image
 * instead of a generic PDF icon — without every visitor downloading the
 * whole (often multi-MB) PDF just to draw a tile.
 *
 * Generating server-side (rather than in the web uploader) covers every
 * upload path: web, admin editor and the Flutter talent app.
 */

const THUMBNAIL_WIDTH_PX = 720;
const JPEG_QUALITY = 82;
// Skip absurdly large files — the client-side fallback can still try.
const MAX_PDF_BYTES = 80 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

export type PortfolioThumbnailTable = 'portfolio_items' | 'agency_portfolio_items';

const require_ = createRequire(__filename);
const pdfjsRoot = path.dirname(require_.resolve('pdfjs-dist/package.json'));
const STANDARD_FONT_DATA_URL = path.join(pdfjsRoot, 'standard_fonts') + path.sep;
const CMAP_URL = path.join(pdfjsRoot, 'cmaps') + path.sep;

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  // pdfjs-dist is ESM-only; a dynamic import keeps it compatible with the
  // backend's CommonJS output and off the startup path.
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

/** Only our own R2 public bucket is fetched — never arbitrary URLs (SSRF). */
export function isOwnStorageUrl(url: string | null | undefined): url is string {
  if (!url || !env.R2_PUBLIC_URL) return false;
  return url.startsWith(`${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/`);
}

async function fetchPdf(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`PDF fetch failed with HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_PDF_BYTES) throw new Error(`PDF too large (${declared} bytes)`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_PDF_BYTES) throw new Error(`PDF too large (${buf.byteLength} bytes)`);
  return buf;
}

/** Render page 1 of a PDF to a JPEG buffer. */
export async function renderPdfCoverJpeg(data: Uint8Array): Promise<Buffer> {
  const pdfjs = await loadPdfJs();
  const { createCanvas } = await import('@napi-rs/canvas');

  const doc = await pdfjs.getDocument({
    data,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH_PX / base.width });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    // PDFs with transparent backgrounds would otherwise encode as black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    return canvas.encode('jpeg', JPEG_QUALITY);
  } finally {
    await doc.destroy();
  }
}

/**
 * Generate and persist a cover thumbnail for one portfolio row. Returns the
 * new thumbnail URL, or null when the row isn't eligible.
 */
export async function generatePortfolioPdfThumbnail(params: {
  table: PortfolioThumbnailTable;
  itemId: string;
  fileUrl: string;
  ownerUserId: string;
}): Promise<string | null> {
  const { table, itemId, fileUrl, ownerUserId } = params;
  if (!isOwnStorageUrl(fileUrl)) return null;

  const pdf = await fetchPdf(fileUrl);
  const jpeg = await renderPdfCoverJpeg(pdf);
  const baseName = decodeURIComponent(fileUrl.split('/').pop() ?? 'portfolio')
    .replace(/\.pdf$/i, '')
    .slice(-60);
  const { fileUrl: thumbnailUrl } = await uploadFile({
    userId: ownerUserId,
    fileName: `${baseName}-cover.jpg`,
    contentType: 'image/jpeg',
    folder: 'portfolio-thumbnails',
    body: jpeg,
  });

  const { error } = await supabaseAdmin
    .from(table)
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', itemId);
  if (error) throw new Error(`Failed to save thumbnail_url: ${error.message}`);
  return thumbnailUrl;
}

// Render one PDF at a time so a burst of uploads can't spike API memory.
let queue: Promise<unknown> = Promise.resolve();

/** Fire-and-forget wrapper used right after a portfolio row is inserted. */
export function queuePortfolioPdfThumbnail(params: {
  table: PortfolioThumbnailTable;
  itemId: string;
  fileUrl: string;
  ownerUserId: string;
}): void {
  queue = queue
    .then(() => generatePortfolioPdfThumbnail(params))
    .catch((err) => {
      console.error(
        `[pdf-thumbnail] ${params.table}/${params.itemId} failed:`,
        err instanceof Error ? err.message : err
      );
    });
}
