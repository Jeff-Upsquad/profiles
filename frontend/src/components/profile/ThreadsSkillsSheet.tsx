import type { ReactNode } from 'react';

interface ThreadsSkillsSheetProps {
  /** e.g. "7 core skills · 11 tools" */
  summary: string;
  /** The skills/tools sections (ThreadsDetailSections variant="sheet"). */
  children: ReactNode;
}

/**
 * Expand mobile details in the page's normal scroll flow. A viewport-anchored
 * sheet can open outside the visible area of the Partner app's embedded WebView.
 * Desktop keeps the separate right rail.
 */
export default function ThreadsSkillsSheet({ summary, children }: ThreadsSkillsSheetProps) {
  return (
    <details className="group mx-4 mt-3 rounded-[14px] bg-zinc-100 sm:mx-6 lg:hidden">
      <summary className="flex min-h-[56px] w-full cursor-pointer list-none items-center gap-3 rounded-[14px] px-3.5 text-left transition-colors hover:bg-zinc-200/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-zinc-950">Skills &amp; tools</span>
          {summary && <span className="mt-0.5 block truncate text-[13px] text-zinc-500">{summary}</span>}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-950 transition-transform group-open:rotate-90" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </summary>
      <div className="mt-2 rounded-b-[14px] border-t border-zinc-200 bg-white px-3.5 py-4">
        {children}
      </div>
    </details>
  );
}
