'use client';

import { useState, type KeyboardEvent } from 'react';

// Free-text tag list input — Enter/comma adds, Backspace removes the last tag.
// Optional `suggestions` render as one-click chips below the field.

export default function TagInput({
  label,
  placeholder,
  values,
  onChange,
  suggestions,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  const unusedSuggestions = (suggestions ?? []).filter(
    (s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="w-full">
      <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#E7E7EA] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus-within:border-[#0a0a0a] focus-within:ring-2 focus-within:ring-[#0a0a0a]/12">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-[#F1F1F3] px-2.5 py-1 text-xs font-medium text-[#0a0a0a]"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-[#737373] hover:text-[#0a0a0a]"
              aria-label={`Remove ${v}`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => add(draft)}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-w-[8rem] flex-1 border-none bg-transparent py-0.5 text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none"
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {unusedSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-[#D4D4D4] px-2.5 py-0.5 text-[11px] font-medium text-[#737373] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a]"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
