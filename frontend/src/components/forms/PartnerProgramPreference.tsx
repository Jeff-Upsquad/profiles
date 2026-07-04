'use client';

import { useMemo } from 'react';
import {
  type DayId,
  type DayHours,
  type DayAvailableHours,
  WEEKDAYS,
  WEEKEND,
  ALL_DAYS,
  monthlyOccurrences,
  fmt,
  parse12,
  build24,
  format12,
} from '@/lib/workHours';

interface Props {
  officeHours: DayHours[];
  onOfficeHoursChange: (next: DayHours[]) => void;
  dailyAvailable: DayAvailableHours[];
  onDailyAvailableChange: (next: DayAvailableHours[]) => void;
}

const MINUTES = [0, 15, 30, 45];
const HOURS12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// ── 12-hour AM/PM time input (stores 24h "HH:MM") ──
function Time12Input({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const parts = parse12(value);
  const hour12 = parts?.hour12 ?? '';
  const minute = parts?.minute ?? 0;
  const meridiem = parts?.meridiem ?? 'AM';

  const emit = (h: number | '', m: number, mer: 'AM' | 'PM') => {
    if (h === '') {
      onChange('');
      return;
    }
    onChange(build24({ hour12: h, minute: m, meridiem: mer }));
  };

  const selectClass =
    'rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20';

  return (
    <div className="flex items-center gap-1.5">
      <select
        aria-label={`${ariaLabel} hour`}
        className={selectClass}
        value={hour12}
        onChange={(e) => emit(e.target.value ? Number(e.target.value) : '', minute, meridiem)}
      >
        <option value="">--</option>
        {HOURS12.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-gray-400">:</span>
      <select
        aria-label={`${ariaLabel} minute`}
        className={selectClass}
        value={minute}
        disabled={hour12 === ''}
        onChange={(e) => emit(hour12, Number(e.target.value), meridiem)}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        aria-label={`${ariaLabel} AM or PM`}
        className={selectClass}
        value={meridiem}
        disabled={hour12 === ''}
        onChange={(e) => emit(hour12, minute, e.target.value as 'AM' | 'PM')}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
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

  const selectedDays = ALL_DAYS.filter((d) => officeMap.has(d.id));

  const weekly = selectedDays.reduce((s, d) => s + (dailyMap.get(d.id)?.hours ?? 0), 0);
  const monthly = useMemo(() => {
    const now = new Date();
    const total = selectedDays.reduce(
      (s, d) => s + (dailyMap.get(d.id)?.hours ?? 0) * monthlyOccurrences(d.id, now),
      0
    );
    return +total.toFixed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeHours, dailyAvailable]);

  const groupTime = (group: typeof WEEKDAYS) => {
    const first = group.find((d) => officeMap.has(d.id));
    const entry = first ? officeMap.get(first.id) : undefined;
    return { from: entry?.from ?? '', to: entry?.to ?? '' };
  };

  const toggleDay = (day: DayId, group: typeof WEEKDAYS) => {
    if (officeMap.has(day)) {
      onOfficeHoursChange(officeHours.filter((h) => h.day !== day));
      onDailyAvailableChange(dailyAvailable.filter((d) => d.day !== day));
    } else {
      const { from, to } = groupTime(group);
      onOfficeHoursChange([...officeHours, { day, from, to }]);
    }
  };

  const setGroupTime = (group: typeof WEEKDAYS, field: 'from' | 'to', value: string) => {
    const ids = new Set(group.map((d) => d.id));
    onOfficeHoursChange(officeHours.map((h) => (ids.has(h.day) ? { ...h, [field]: value } : h)));
  };

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
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-medium text-[#737373]">Office hours</span>
            <Time12Input value={from} onChange={(v) => setGroupTime(group, 'from', v)} ariaLabel={`${title} from`} />
            <span className="text-xs text-gray-400">to</span>
            <Time12Input value={to} onChange={(v) => setGroupTime(group, 'to', v)} ariaLabel={`${title} to`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Virtual Office Hours */}
      <div>
        <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
          Virtual Office Hours <span className="text-red-500">*</span>
        </h3>
        <p className="mb-4 mt-1 text-sm text-[#737373]">
          Pick the days you&apos;re available and set your virtual office hours for each group.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {renderGroup('Weekdays (Mon–Fri)', WEEKDAYS)}
          {renderGroup('Weekend (Sat–Sun)', WEEKEND)}
        </div>
      </div>

      {/* Daily Available Hours */}
      <div>
        <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
          Daily Available Hours <span className="text-red-500">*</span>
        </h3>
        <p className="mb-4 mt-1 text-sm text-[#737373]">
          For each available day, how many hours can you commit? (Your hourly commitment.)
        </p>

        {selectedDays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E7E7EA] bg-[#F5F5F6] px-4 py-6 text-center text-sm text-[#737373]">
            Select your available days under Virtual Office Hours first.
          </div>
        ) : (
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
              {selectedDays.map((d) => {
                const office = officeMap.get(d.id);
                const window =
                  office?.from && office?.to ? `${format12(office.from)} – ${format12(office.to)}` : 'No office hours set';
                return (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                    <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700">{d.label}</div>
                    <div className="flex-1 text-xs text-gray-400">{window}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        value={dailyMap.get(d.id)?.hours ?? ''}
                        onChange={(e) => setDayHours(d.id, e.target.value)}
                        className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/20"
                        aria-label={`${d.label} available hours`}
                      />
                      <span className="text-xs text-gray-500">hrs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
