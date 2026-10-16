'use client';

// Lazy, browser-only loader for pdf.js. Portfolio PDFs are rendered with
// pdf.js instead of the browser's native viewer because mobile browsers
// (iOS Safari in particular) only paint the first page of a PDF inside an
// <iframe> and won't let the user scroll through the rest of the document.
//
// We use the "legacy" build so older mobile Safari/Chrome versions that lack
// newer JS built-ins (e.g. Promise.withResolvers) still work.

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

export function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('pdf.js can only be loaded in the browser'));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        return pdfjs;
      })
      .catch((err) => {
        pdfjsPromise = null;
        throw err;
      });
  }
  return pdfjsPromise;
}

// Shared getDocument options. Range/stream requests are disabled on purpose:
// the R2 public bucket answers simple CORS GETs but rejects the preflight a
// `Range` header triggers, so a single plain GET is the reliable path.
export const PDF_DOCUMENT_OPTIONS = {
  disableRange: true,
  disableStream: true,
  isEvalSupported: false,
} as const;
