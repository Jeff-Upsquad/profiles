'use client';

import { useEffect, useState } from 'react';

interface ThreadsSkillsSheetProps {
  /** e.g. "7 core skills · 11 tools" */
  summary: string;
  /** The skills/tools sections (ThreadsDetailSections variant="sheet"). */
  children: React.ReactNode;
}

/**
 * Below lg the right rail is gone, so skills & tools sit behind a single row
 * that opens a bottom sheet.
 */
export default function ThreadsSkillsSheet({ summary, children }: ThreadsSkillsSheetProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div className="px-4 pt-3 sm:px-6 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-[56px] w-full items-center gap-3 rounded-[14px] bg-zinc-100 px-3.5 text-left transition-colors hover:bg-zinc-200/70"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-zinc-950">Skills &amp; tools</span>
          {summary && <span className="mt-0.5 block truncate text-[13px] text-zinc-500">{summary}</span>}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-950" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Skills and tools"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[92vh] w-full max-w-[640px] flex-col rounded-t-[22px] bg-white"
          >
            <div className="flex justify-center pt-2" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-zinc-300" />
            </div>
            <div className="flex items-center justify-between border-b border-zinc-200 py-1.5 pl-5 pr-2">
              <h2 className="text-[17px] font-bold text-zinc-950">Skills &amp; tools</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-zinc-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-950" aria-hidden="true">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
              {children}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
