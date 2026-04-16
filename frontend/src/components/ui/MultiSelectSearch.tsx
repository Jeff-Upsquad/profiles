'use client';

import { useState, useRef, useEffect } from 'react';

interface MultiSelectSearchProps {
  label?: string;
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  error?: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
}

export default function MultiSelectSearch({
  label,
  options,
  selected,
  onChange,
  error,
  placeholder = 'Type to search...',
  helperText,
  required,
}: MultiSelectSearchProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(
    (opt) =>
      !selected.includes(opt.value) &&
      opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addItem = (value: string) => {
    onChange([...selected, value]);
    setSearch('');
  };

  const removeItem = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  const getLabel = (value: string) =>
    options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {helperText && !error && (
        <p className="mb-1 text-xs text-gray-500">{helperText}</p>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700"
            >
              {getLabel(val)}
              <button
                type="button"
                onClick={() => removeItem(val)}
                className="ml-0.5 text-indigo-400 hover:text-indigo-600"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-indigo-500'
          }`}
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
        />

        {/* Dropdown */}
        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
            {filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
                  onClick={() => addItem(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && search && filtered.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
            No options found
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
