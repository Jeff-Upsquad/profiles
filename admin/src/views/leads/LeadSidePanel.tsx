'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import LeadSidePanelContent from './LeadSidePanelContent';

interface Props {
  leadId: string | null;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number | null;
  totalCount: number;
}

export default function LeadSidePanel({
  leadId,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
}: Props) {
  // Keyboard: Esc to close, ←/→ to navigate
  useEffect(() => {
    if (!leadId) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack when user is typing in an input/textarea/select.
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev) onNavigate(-1);
      else if (e.key === 'ArrowRight' && hasNext) onNavigate(1);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [leadId, hasPrev, hasNext, onNavigate, onClose]);

  if (!leadId) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30 transition-opacity"
        onClick={onClose}
      />
      {/* Panel */}
      <aside className="relative flex w-full max-w-2xl flex-col bg-gray-50 shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigate(-1)}
              disabled={!hasPrev}
              title="Previous (←)"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              aria-label="Previous candidate"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => onNavigate(1)}
              disabled={!hasNext}
              title="Next (→)"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              aria-label="Next candidate"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {currentIndex !== null && (
              <span className="ml-2 text-xs text-gray-500">
                {currentIndex + 1} of {totalCount} on this page
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <LeadSidePanelContent leadId={leadId} onClose={onClose} />
        </div>
      </aside>
    </div>,
    document.body
  );
}
