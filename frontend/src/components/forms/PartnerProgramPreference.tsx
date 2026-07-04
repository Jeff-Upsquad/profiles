'use client';

import { useMemo, useRef } from 'react';
import {
  type DayId,
  type DayHours,
  type DayAvailableHours,
  WEEKDAYS,
  WEEKEND,
  ALL_DAYS,
  toMinutes,
  minutesToTime,
  monthlyOccurrences,
  fmt,
  format12,
} from '@/lib/workHours';

interface Props {
  officeHours: DayHours[];
  onOfficeHoursChange: (next: DayHours[]) => void;
  dailyAvailable: DayAvailableHours[];
  onDailyAvailableChange: (next: DayAvailableHours[]) => void;
}

const DEFAULT_FROM = '09:00';
const DEFAULT_TO = '17:00';
const MIN = 0;
const MAX = 1440; // minutes in a day
const STEP = 30;
const GAP = 30; // keep the two handles at least 30 min apart

// Display a minute value in 12h form ('12:00 AM' for the 24:00 end-of-day).
function label(min: number): string {
  return min >= MAX ? '12:00 AM' : format12(minutesToTime(min));
}

// ── Horizontal dual-handle time-window slider (stores 24h "HH:MM") ──
function TimeRangeSlider({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<'from' | 'to' | null>(null);

  const f = toMinutes(from) ?? 540;
  const t = toMinutes(to) ?? 1020;

  const snap = (v: number) => Math.round(Math.min(MAX, Math.max(MIN, v)) / STEP) * STEP;
  const valueAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return f;
    const rect = el.getBoundingClientRect();
    return snap(MIN + ((clientX - rect.left) / rect.width) * (MAX - MIN));
  };

  const move = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const v = valueAt(e.clientX);
    if (dragRef.current === 'from') onChange(minutesToTime(Math.min(v, t - GAP)), minutesToTime(t));
    else onChange(minutesToTime(f), minutesToTime(Math.max(v, f + GAP)));
  };
  const start = (which: 'from' | 'to') => (e: React.PointerEvent) => {
    dragRef.current = which;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const end = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };
  const nudge = (which: 'from' | 'to') => (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? STEP : e.key === 'ArrowLeft' ? -STEP : 0;
    if (!d) return;
    e.preventDefault();
    if (which === 'from') onChange(minutesToTime(Math.min(snap(f + d), t - GAP)), minutesToTime(t));
    else onChange(minutesToTime(f), minutesToTime(Math.max(snap(t + d), f + GAP)));
  };

  const pct = (v: number) => `${((v - MIN) / (MAX - MIN)) * 100}%`;

  const handle = (which: 'from' | 'to', v: number) => (
    <div
      role="slider"
      aria-label={which === 'from' ? 'Office start time' : 'Office end time'}
      aria-valuetext={label(v)}
      tabIndex={0}
      onPointerDown={start(which)}
      onPointerMove={move}
      onPointerUp={end}
      onKeyDown={nudge(which)}
      className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-[#0a0a0a] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform active:scale-110 active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/30"
      style={{ left: pct(v) }}
    />
  );

  return (
    <div className="pt-2">
      <div className="mb-2.5 text-sm font-semibold text-[#0a0a0a]">
        {label(f)} <span className="text-gray-400">–</span> {label(t)}
      </div>
      <div ref={trackRef} className="relative mx-2.5 h-2 rounded-full bg-gray-200">
        <div
          className="absolute h-2 rounded-full bg-[#0a0a0a]"
          style={{ left: pct(f), right: `calc(100% - ${pct(t)})` }}
        />
        {handle('from', f)}
        {handle('to', t)}
      </div>
      {/* AM/PM markers — kept faint on purpose */}
      <div className="mx-2.5 mt-2 flex justify-between text-[10px] text-gray-400">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  );
}

export default function PartnerProgramPreference({
  officeHours,
  onOfficeHoursChange,
  dailyAvailable,
  onDailyAvailableChange,
}: Props) {
  const officeMap = useMemo(() => new Map(officeHours.map((h) => [h.day, h])), [officeHours]);
  const dailyMap = useMemo(() => new Map(dailyAvailable.map((d) => [d.day, d])), [dailyAvailable]);

  const groupTime = (group: typeof WEEKDAYS) => {
    const first = group.find((d) => officeMap.has(d.id));
    const entry = first ? officeMap.get(first.id) : undefined;
    return { from: entry?.from ?? '', to: entry?.to ?? '' };
  };

  const toggleDay = (day: DayId, group: typeof WEEKDAYS) => {
    if (officeMap.has(day)) {
      onOfficeHoursChange(officeHours.filter((h) => h.day !== day));
    } else {
      let { from, to } = groupTime(group);
      if (!from || !to) {
        from = DEFAULT_FROM;
        to = DEFAULT_TO;
      }
      onOfficeHoursChange([...officeHours, { day, from, to }]);
    }
  };

  const setGroupWindow = (group: typeof WEEKDAYS, from: string, to: string) => {
    const ids = new Set(group.map((d) => d.id));
    onOfficeHoursChange(officeHours.map((h) => (ids.has(h.day) ? { ...h, from, to } : h)));
  };

  // Daily Available Hours are independent of the office-hours window — the
  // talent tells us how many hours they'll actually commit each day.
  const setDayHours = (day: DayId, raw: string) => {
    const others = dailyAvailable.filter((d) => d.day !== day);
    if (raw === '') {
      onDailyAvailableChange(others);
      return;
    }
    const hours = Math.min(24, Math.max(0, Number(raw)));
    if (Number.isNaN(hours)) {
      onDailyAvailableChange(others);
      return;
    }
    onDailyAvailableChange([...others, { day, hours }]);
  };

  const weekly = ALL_DAYS.reduce((s, d) => s + (dailyMap.get(d.id)?.hours ?? 0), 0);
  const monthly = useMemo(() => {
    const now = new Date();
    const total = ALL_DAYS.reduce(
      (s, d) => s + (dailyMap.get(d.id)?.hours ?? 0) * monthlyOccurrences(d.id, now),
      0
    );
    return +total.toFixed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyAvailable]);

  const renderGroup = (title: string, group: typeof WEEKDAYS) => {
    const hasSelection = group.some((d) => officeMap.has(d.id));
    const { from, to } = groupTime(group);
    return (
      <div className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-4">
        <p className="mb-3 text-sm font-semibold text-[#0a0a0a]">{title}</p>
        <div className="flex flex-wrap gap-2">
          {group.map((d) => {
            const on = officeMap.has(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDay(d.id, group)}
                aria-pressed={on}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  on
                    ? 'border-[#0a0a0a] bg-[#FFFAC2] text-[#0a0a0a]'
                    : 'border-[#E7E7EA] bg-white text-[#737373] hover:border-[#0a0a0a]/40'
                }`}
              >
                {d.short}
              </button>
            );
          })}
        </div>
        {hasSelection && (
          <TimeRangeSlider
            from={from || DEFAULT_FROM}
            to={to || DEFAULT_TO}
            onChange={(f2, t2) => setGroupWindow(group, f2, t2)}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Virtual Office Hours — a time window */}
      <div>
        <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
          Virtual Office Hours <span className="text-red-500">*</span>
        </h3>
        <p className="mb-4 mt-1 text-sm text-[#737373]">
          Pick the days you&apos;re available, then drag the slider to set your office-hours window for each group.
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {renderGroup('Weekdays (Mon–Fri)', WEEKDAYS)}
          {renderGroup('Weekend (Sat–Sun)', WEEKEND)}
        </div>
      </div>

      {/* Daily Available Hours — how many hours you'll actually commit.
          Independent of the office-hours window above. */}
      <div>
        <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
          Daily Available Hours <span className="text-red-500">*</span>
        </h3>
        <p className="mb-4 mt-1 text-sm text-[#737373]">
          How many hours can you actually commit each day? This is separate from your office-hours window.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E7E7EA] bg-[#F5F5F6] px-4 py-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#0a0a0a]">Total per week</p>
              <p className="mt-0.5 text-xl font-bold text-[#0a0a0a]">
                {fmt(weekly)} <span className="text-sm font-medium">hrs</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#0a0a0a]">Total per month</p>
              <p className="mt-0.5 text-xl font-bold text-[#0a0a0a]">
                {fmt(monthly)} <span className="text-sm font-medium">hrs</span>
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {ALL_DAYS.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="text-sm font-medium text-gray-700">{d.label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={dailyMap.get(d.id)?.hours ?? ''}
                    onChange={(e) => setDayHours(d.id, e.target.value)}
                    placeholder="0"
                    className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20"
                    aria-label={`${d.label} available hours`}
                  />
                  <span className="text-xs text-gray-500">hrs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
