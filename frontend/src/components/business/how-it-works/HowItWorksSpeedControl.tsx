'use client';

import { useEffect, useRef, useState } from 'react';

export const HOW_IT_WORKS_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export default function HowItWorksSpeedControl({
  rate,
  onChange,
  menuPlacement = 'down',
  className = '',
}: {
  rate: number;
  onChange: (rate: number) => void;
  menuPlacement?: 'up' | 'down';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const menuPos = menuPlacement === 'down' ? 'top-full mt-1' : 'bottom-full mb-1';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Playback speed"
        className="flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-md border border-black/10 bg-white/95 text-slate-700 hover:border-gray-300 shadow-sm"
      >
        {rate}×
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 ${menuPos} w-20 bg-white border border-black/10 rounded-lg shadow-lg overflow-hidden z-20`}
        >
          {HOW_IT_WORKS_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === rate}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs ${
                s === rate
                  ? 'bg-[#F5F5F6] text-[#0a0a0a]'
                  : 'text-slate-600 hover:bg-[#F5F5F6]'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
