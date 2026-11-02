'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ThreadsSkillsSheetProps {
  summary: string;
  /** The skills/tools sections (ThreadsDetailSections variant="sheet"). */
  children: ReactNode;
}

export default function ThreadsSkillsSheet({ summary, children }: ThreadsSkillsSheetProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      // Android WebViews can have a layout viewport taller than the visible
      // screen. Anchor to the visible viewport rather than a vh-based flex end.
      Object.assign(dialog.style, {
        top: `${viewport?.offsetTop ?? 0}px`,
        left: `${viewport?.offsetLeft ?? 0}px`,
        width: `${viewport?.width || window.innerWidth}px`,
        height: `${viewport?.height || window.innerHeight}px`,
      });
    };
    updateViewport();
    // The browser's top layer escapes ancestor clipping and stacking contexts,
    // traps focus, and makes the background inert in both web and native hosts.
    dialog.showModal();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('resize', updateViewport);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      dialog.close();
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className="px-4 pt-3 sm:px-6 lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
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

      {open && createPortal(
        <dialog
          ref={dialogRef}
          aria-label="Skills and tools"
          aria-modal="true"
          onCancel={() => setOpen(false)}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          className="fixed m-0 max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-black/45"
        >
          <section className="animate-sheet-up absolute inset-x-0 bottom-0 mx-auto flex max-h-[92%] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[22px] bg-white motion-reduce:animate-none">
            <div className="flex shrink-0 justify-center pt-2" aria-hidden="true">
              <span className="h-1 w-9 rounded-full bg-zinc-300" />
            </div>
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 py-1.5 pl-5 pr-2">
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
        </dialog>,
        document.body
      )}
    </div>
  );
}
