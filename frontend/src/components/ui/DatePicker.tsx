import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface DatePickerProps {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  required?: boolean;
  error?: string;
  helperText?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Show "Age N" hint under the field (ideal for date of birth). */
  showAge?: boolean;
  id?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

/** Accepts DD/MM/YYYY (also DD-MM-YYYY / DD.MM.YYYY, with or without separators). */
function parseTyped(text: string): { y: number; m: number; d: number } | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const d = Number(digits.slice(0, 2));
  const mo = Number(digits.slice(2, 4));
  const y = Number(digits.slice(4, 8));
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

function formatSlash(iso: string) {
  const p = parseISO(iso);
  if (!p) return '';
  return `${pad(p.d)}/${pad(p.m)}/${p.y}`;
}

function formatLong(iso: string) {
  const p = parseISO(iso);
  if (!p) return '';
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

function ageFromISO(iso: string): number | null {
  const p = parseISO(iso);
  if (!p) return null;
  const now = new Date();
  let age = now.getFullYear() - p.y;
  const m = now.getMonth() - (p.m - 1);
  if (m < 0 || (m === 0 && now.getDate() < p.d)) age--;
  return age;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function clampISO(iso: string, min?: string, max?: string) {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

export default function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  required,
  error,
  helperText,
  placeholder = 'DD / MM / YYYY',
  disabled,
  showAge,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => formatSlash(value));
  const [touched, setTouched] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const todayISO = useMemo(() => {
    const n = new Date();
    return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }, []);

  const minYear = min ? Number(min.slice(0, 4)) : 1900;
  const maxYear = max ? Number(max.slice(0, 4)) : Number(todayISO.slice(0, 4));

  const selected = parseISO(value);

  // Calendar view (month being browsed). When opened with no value, jump to a
  // sensible spot — for DOB fields (max ≈ today) that's ~25 years back so the
  // user isn't paging from the current month.
  const defaultView = useCallback((): { y: number; m: number } => {
    if (selected) return { y: selected.y, m: selected.m };
    if (max) {
      const p = parseISO(max);
      if (p) return { y: p.y, m: p.m };
    }
    const n = new Date();
    n.setFullYear(n.getFullYear() - 25);
    return { y: n.getFullYear(), m: n.getMonth() + 1 };
  }, [selected, max]);

  const [view, setView] = useState(defaultView);

  // Keep the text field in sync when the value changes externally.
  useEffect(() => {
    setText(formatSlash(value));
  }, [value]);

  useEffect(() => {
    if (open) setView(defaultView());
  }, [open, defaultView]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open ]);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1).getDay(); // 0 = Sunday
    const total = daysInMonth(view.y, view.m);
    const prevTotal = daysInMonth(view.y, view.m - 1);
    const out: { d: number; inMonth: boolean; iso: string }[] = [];
    for (let i = first - 1; i >= 0; i--) {
      const d = prevTotal - i;
      const pm = view.m === 1 ? 12 : view.m - 1;
      const py = view.m === 1 ? view.y - 1 : view.y;
      out.push({ d, inMonth: false, iso: toISO(py, pm, d) });
    }
    for (let d = 1; d <= total; d++) out.push({ d, inMonth: true, iso: toISO(view.y, view.m, d) });
    while (out.length % 7 !== 0) {
      const last = out.length;
      const d = last - (first + total) + 1;
      const nm = view.m === 12 ? 1 : view.m + 1;
      const ny = view.m === 12 ? view.y + 1 : view.y;
      out.push({ d, inMonth: false, iso: toISO(ny, nm, d) });
    }
    return out;
  }, [view]);

  const commit = (iso: string) => {
    if (!clampISO(iso, min, max)) return;
    onChange(iso);
    setText(formatSlash(iso));
    setTouched(false);
    setOpen(false);
  };

  const handleTextChange = (raw: string) => {
    // Auto-insert slashes while typing digits: DD/MM/YYYY.
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let pretty = digits;
    if (digits.length > 4) pretty = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) pretty = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(pretty);
    setTouched(true);
    if (digits.length === 8) {
      const p = parseTyped(pretty);
      if (p) {
        const iso = toISO(p.y, p.m, p.d);
        if (clampISO(iso, min, max)) {
          onChange(iso);
          setView({ y: p.y, m: p.m });
          setTouched(false);
        }
      }
    } else if (digits.length === 0) {
      onChange('');
      setTouched(false);
    }
  };

  const handleBlur = () => {
    if (!touched) {
      setText(formatSlash(value));
      return;
    }
    // Snap incomplete/invalid typing back to the last committed value.
    if (!text) {
      onChange('');
      return;
    }
    const p = parseTyped(text);
    if (!p) {
      setText(formatSlash(value));
      setTouched(false);
      return;
    }
    const iso = toISO(p.y, p.m, p.d);
    if (!clampISO(iso, min, max)) {
      setText(formatSlash(value));
      setTouched(false);
      return;
    }
    onChange(iso);
    setText(formatSlash(iso));
    setTouched(false);
  };

  const stepMonth = (dir: 1 | -1) => {
    setView((v) => {
      const dt = new Date(v.y, v.m - 1 + dir, 1);
      const ny = dt.getFullYear();
      const nm = dt.getMonth() + 1;
      if (ny < minYear || ny > maxYear) return v;
      return { y: ny, m: nm };
    });
  };

  const age = value ? ageFromISO(value) : null;
  const typedInvalid = touched && text.length === 10 && !parseTyped(text);
  const outOfRange =
    touched && text.length === 10 && parseTyped(text)
      ? !clampISO(toISO(parseTyped(text)!.y, parseTyped(text)!.m, parseTyped(text)!.d), min, max)
      : false;

  const todayInRange = clampISO(todayISO, min, max);
  const inputId = id || (label ? `dp-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);

  return (
    <div ref={wrapRef} className="relative w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}

      <div
        className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 ${
          error || typedInvalid || outOfRange
            ? 'border-red-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15'
            : 'border-[#E7E7EA] focus-within:border-[#0a0a0a] focus-within:ring-2 focus-within:ring-[#0a0a0a]/12'
        } ${disabled ? 'cursor-not-allowed bg-[#F5F5F6]' : ''} ${open ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/12' : ''}`}
      >
        <input
          id={inputId}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          onFocus={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleBlur();
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:outline-none disabled:cursor-not-allowed disabled:text-[#a3a3a3]"
        />
        {value && age !== null && showAge && (
          <span className="shrink-0 rounded-full bg-[#F5F5F6] px-2 py-0.5 text-[11px] font-semibold text-[#525252]">
            {age} yrs
          </span>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={open ? 'Close calendar' : 'Open calendar'}
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center justify-center rounded-md p-1 text-[#737373] transition-colors hover:bg-[#F5F5F6] hover:text-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] origin-top-left rounded-2xl border border-[#E7E7EA] bg-white p-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] animate-[dp-pop_140ms_ease-out]"
        >
          {/* Month / year jump — the key DOB UX: no endless paging back decades */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => stepMonth(-1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#525252] transition-colors hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <select
              aria-label="Month"
              value={view.m}
              onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
              className="h-8 min-w-0 flex-1 cursor-pointer rounded-lg border border-[#E7E7EA] bg-white px-1.5 text-[13px] font-semibold text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={view.y}
              onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
              className="h-8 w-[84px] shrink-0 cursor-pointer rounded-lg border border-[#E7E7EA] bg-white px-1.5 text-[13px] font-semibold text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => stepMonth(1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#525252] transition-colors hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day grid */}
          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
                {w}
              </div>
            ))}
            {cells.map((c) => {
              const isSelected = value === c.iso;
              const isToday = todayISO === c.iso;
              const allowed = clampISO(c.iso, min, max);
              return (
                <button
                  key={c.iso}
                  type="button"
                  disabled={!allowed}
                  onClick={() => commit(c.iso)}
                  aria-label={formatLong(c.iso)}
                  aria-pressed={isSelected}
                  className={`flex h-9 items-center justify-center rounded-lg text-[13px] transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#0a0a0a] font-semibold text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)]'
                      : !allowed
                        ? 'cursor-not-allowed text-[#E7E7EA]'
                        : isToday
                          ? 'font-semibold text-[#0a0a0a] ring-1 ring-inset ring-[#0a0a0a] hover:bg-[#F5F5F6]'
                          : c.inMonth
                            ? 'text-[#3F3F46] hover:bg-[#FFFAC2] hover:text-[#0a0a0a] active:scale-95'
                            : 'text-[#c9c9c9] hover:bg-[#F5F5F6]'
                  }`}
                >
                  {c.d}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between border-t border-[#F0F0F0] pt-2">
            <button
              type="button"
              onClick={() => { onChange(''); setText(''); setTouched(false); setOpen(false); }}
              className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#737373] transition-colors hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            >
              Clear
            </button>
            {value && (
              <span className="text-xs text-[#737373]">{formatLong(value)}</span>
            )}
            {todayInRange ? (
              <button
                type="button"
                onClick={() => commit(todayISO)}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#FFFAC2]"
              >
                Today
              </button>
            ) : (
              <span className="w-[52px]" />
            )}
          </div>
        </div>
      )}

      {(error || typedInvalid || outOfRange) && (
        <p className="mt-1 text-xs text-red-600">
          {error || (outOfRange ? 'Date is out of allowed range' : 'Enter a valid date (DD/MM/YYYY)')}
        </p>
      )}
      {!(error || typedInvalid || outOfRange) && (helperText || (showAge && value && age !== null)) && (
        <p className="mt-1 text-xs text-[#737373]">
          {showAge && value && age !== null ? `Age: ${age} years` : helperText}
        </p>
      )}
      {!(error || typedInvalid || outOfRange) && !helperText && !(showAge && value) && (
        <p className="mt-1 text-xs text-[#737373]">Type or pick from the calendar</p>
      )}

      <style>{`@keyframes dp-pop { from { opacity: 0; transform: scale(0.97) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </div>
  );
}
