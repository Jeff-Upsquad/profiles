'use client';

import { useEffect, useState } from 'react';

interface FirstItemTipProps {
  storageKey: string;
  message: string;
}

export function FirstItemTip({ storageKey, message }: FirstItemTipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) !== 'dismissed') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, 'dismissed');
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

  return (
    <div
      className="px-3 pb-3 pt-1 sm:px-6 sm:pb-4"
      style={{ animation: 'first-item-tip-in 220ms ease-out both' }}
      role="status"
    >
      <div className="relative ml-0 sm:ml-14 max-w-[420px]">
        {/* Arrow pointing up at the row above */}
        <div
          className="absolute left-6 -top-1 h-2.5 w-2.5 rotate-45 bg-[#0a0a0a]"
          aria-hidden="true"
        />

        {/* Bubble */}
        <div className="relative rounded-xl bg-[#0a0a0a] px-3.5 py-3 text-white shadow-[0_8px_24px_-8px_rgba(10,10,10,0.4)]">
          <div className="flex items-start gap-2.5">
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FFFAC2]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="flex-1 font-[family-name:var(--font-inter)] text-[12.5px] font-medium leading-relaxed">
              {message}
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss tip"
              className="-mr-1 -mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="text-[11px] font-semibold text-[#FFFAC2] transition-opacity hover:opacity-80"
            >
              Got it
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes first-item-tip-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
