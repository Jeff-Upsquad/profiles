import { useState } from 'react';
import { INDUSTRY_OPTIONS } from '@/constants/industries';

export interface IndustryExperienceEntry {
  industry: string;
  /** 'YYYY-MM' */
  from: string;
  /** 'YYYY-MM' — empty when `current` is true */
  to: string;
  current?: boolean;
}

interface Props {
  value: IndustryExperienceEntry[];
  onChange: (next: IndustryExperienceEntry[]) => void;
}

function monthsBetween(from: string, to: string): number {
  if (!from) return 0;
  const [fy, fm] = from.split('-').map(Number);
  const end = to ? to.split('-').map(Number) : null;
  const now = new Date();
  const ty = end ? end[0] : now.getFullYear();
  const tm = end ? end[1] : now.getMonth() + 1;
  if (!fy || !fm) return 0;
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

function durationLabel(from: string, to: string): string {
  const total = monthsBetween(from, to);
  const years = Math.floor(total / 12);
  const months = total % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years > 1 ? 's' : ''}`);
  if (months) parts.push(`${months} mo${months > 1 ? 's' : ''}`);
  return parts.length ? parts.join(' ') : 'Less than a month';
}

function formatMonth(value: string): string {
  if (!value) return '';
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return value;
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

export default function IndustryExperiencePicker({ value, onChange }: Props) {
  const [industry, setIndustry] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [current, setCurrent] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setIndustry('');
    setFrom('');
    setTo('');
    setCurrent(false);
  };

  const add = () => {
    if (!industry) return setError('Select an industry');
    if (!from) return setError('Enter a start date');
    if (!current && !to) return setError('Enter an end date (or mark as current)');
    if (!current && to && from > to) return setError('End date must be after start date');
    if (value.some((v) => v.industry === industry && v.from === from)) {
      return setError('That industry and start date is already added');
    }
    onChange([...value, { industry, from, to: current ? '' : to, current }]);
    reset();
    setError('');
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  // Industries already added (with no remaining "Other" cap) are hidden from the
  // dropdown to reduce duplicates — except "Other", which can repeat.
  const usedSingles = new Set(value.filter((v) => v.industry !== 'Other').map((v) => v.industry));

  return (
    <div>
      {/* Existing entries */}
      {value.length > 0 && (
        <div className="mb-4 space-y-2">
          {value.map((entry, idx) => (
            <div
              key={`${entry.industry}-${entry.from}-${idx}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{entry.industry}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatMonth(entry.from)} – {entry.current ? 'Present' : formatMonth(entry.to)}
                  <span className="mx-1.5 text-gray-300">·</span>
                  {durationLabel(entry.from, entry.to)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="flex-shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                aria-label="Remove"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      <div className="rounded-lg border border-dashed border-gray-300 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Industry</label>
            <select
              className={inputCls}
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                setError('');
              }}
            >
              <option value="">Select an industry…</option>
              {INDUSTRY_OPTIONS.filter((o) => o === industry || o === 'Other' || !usedSingles.has(o)).map(
                (opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">From</label>
            <input
              type="month"
              className={inputCls}
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setError('');
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">To</label>
            <input
              type="month"
              className={inputCls}
              value={to}
              min={from || undefined}
              disabled={current}
              onChange={(e) => {
                setTo(e.target.value);
                setError('');
              }}
            />
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            checked={current}
            onChange={(e) => {
              setCurrent(e.target.checked);
              if (e.target.checked) setTo('');
              setError('');
            }}
          />
          I currently work in this industry
        </label>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <button
          type="button"
          onClick={add}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add industry
        </button>
      </div>
    </div>
  );
}
