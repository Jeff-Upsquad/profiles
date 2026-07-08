'use client';

import { useEffect, useRef, useState } from 'react';

interface Option {
  label: string;
  value: string;
}

// Multi-select dropdown with search — selected values render as removable
// chips in the control, options toggle via a checklist panel. Matches the
// look of Select/TagInput (same border, radius, chip styling).

export default function MultiSelect({
  label,
  placeholder,
  options,
  values,
  onChange,
  disabled,
  emptyHint,
  searchPlaceholder,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  emptyHint?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="w-full" ref={ref}>
      <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all ${
            disabled
              ? 'cursor-not-allowed border-[#E7E7EA] bg-[#F5F5F6]'
              : 'border-[#E7E7EA] bg-white hover:border-[#a3a3a3]'
          } ${open ? '!border-[#0a0a0a] ring-2 ring-[#0a0a0a]/12' : ''}`}
        >
          {values.length === 0 ? (
            <span className="text-sm text-[#a3a3a3]">{placeholder}</span>
          ) : (
            values.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F1F1F3] px-2.5 py-1 text-xs font-medium text-[#0a0a0a]"
                >
                  {opt?.label ?? v}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(v);
                      }
                    }}
                    className="text-[#737373] hover:text-[#0a0a0a]"
                    aria-label={`Remove ${opt?.label ?? v}`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                </span>
              );
            })
          )}
          <svg
            className={`ml-auto h-4 w-4 flex-shrink-0 text-[#a3a3a3] transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && !disabled && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-[#E7E7EA] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <div className="flex items-center gap-2 border-b border-[#E7E7EA] px-3 py-2 text-[#a3a3a3]">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder ?? 'Search'}
                className="w-full border-none bg-transparent text-sm text-[#0a0a0a] outline-none placeholder:text-[#a3a3a3]"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {options.length === 0 ? (
                <p className="px-3 py-2.5 text-[13px] text-[#a3a3a3]">{emptyHint ?? 'No options available'}</p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-[13px] text-[#a3a3a3]">No matches</p>
              ) : (
                filtered.map((o) => {
                  const on = values.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggle(o.value)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[#F5F5F6]"
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                          on ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#D4D4D4]'
                        }`}
                      >
                        {on && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[#0a0a0a]">{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
