'use client';

import { useEffect, useRef } from 'react';

export interface HowItWorksLanguage {
  code: string;
  name: string;
}

// Ported from the upsquad-site LanguageGate: play opens a modal picker,
// choosing a language starts playback. Focus-trapped + Escape to dismiss.
export default function HowItWorksLanguageGate({
  open,
  languages,
  selectedCode,
  onSelect,
  onDismiss,
}: {
  open: boolean;
  languages: HowItWorksLanguage[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  onDismiss: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const focusables = panelRef.current?.querySelectorAll('button');
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss?.();
      } else if (e.key === 'Tab' && focusables && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const prev = previouslyFocused.current as HTMLElement | null;
      if (prev && typeof prev.focus === 'function') prev.focus();
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-it-works-language-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div ref={panelRef} className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-[#E7E7EA]">
          <h2 id="how-it-works-language-title" className="text-lg font-semibold text-[#0a0a0a]">
            Choose your language
          </h2>
          <p className="text-sm text-[#525252] mt-1">Pick a language to watch the video.</p>
        </div>
        <ul className="py-2">
          {languages.map((lang) => {
            const active = lang.code === selectedCode;
            return (
              <li key={lang.code}>
                <button
                  type="button"
                  onClick={() => onSelect?.(lang.code)}
                  className={`w-full flex items-center text-left px-6 py-3 text-sm font-medium transition-colors ${
                    active ? 'bg-[#F5F5F6] text-[#0a0a0a]' : 'text-slate-800 hover:bg-[#F5F5F6]'
                  }`}
                >
                  {lang.name}
                  <span className="ml-2 text-xs text-[#737373]">{lang.code.toUpperCase()}</span>
                  {active && <span className="ml-auto text-xs font-medium text-[#0a0a0a]">Selected</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="px-6 py-3 border-t border-[#E7E7EA] text-right">
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-[#525252] hover:text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
