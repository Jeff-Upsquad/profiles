'use client';

import { useMemo } from 'react';

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  day: DayId;
  from: string;
  to: string;
}

interface Props {
  value: DayHours[];
  onChange: (next: DayHours[]) => void;
}

const DAYS: { id: DayId; label: string }[] = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'sun', label: 'Sunday' },
];

const TIME_RE = /^\d{2}:\d{2}$/;

function toMinutes(t: string): number | null {
  if (!TIME_RE.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function dailyHours(from: string, to: string): number {
  const a = toMinutes(from);
  const b = toMinutes(to);
  if (a == null || b == null) return 0;
  return Math.max(0, b - a) / 60;
}

const DAY_TO_DOW: Record<DayId, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function monthlyOccurrences(dayId: DayId, ref: Date): number {
  const target = DAY_TO_DOW[dayId];
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstOccurrenceDay = 1 + ((target - firstDow + 7) % 7);
  return Math.floor((daysInMonth - firstOccurrenceDay) / 7) + 1;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function buildBaseline(value: DayHours[]): DayHours[] {
  const map = new Map(value.map((v) => [v.day, v]));
  return DAYS.map(({ id }) => map.get(id) ?? { day: id, from: '', to: '' });
}

export default function VirtualOfficeHoursPicker({ value, onChange }: Props) {
  const rows = useMemo(() => buildBaseline(value), [value]);

  const weekly = useMemo(
    () => rows.reduce((sum, r) => sum + dailyHours(r.from, r.to), 0),
    [rows]
  );
  const monthly = useMemo(() => {
    const now = new Date();
    const total = rows.reduce(
      (sum, r) => sum + dailyHours(r.from, r.to) * monthlyOccurrences(r.day, now),
      0
    );
    return +total.toFixed(1);
  }, [rows]);

  const update = (day: DayId, patch: Partial<DayHours>) => {
    const next = rows.map((r) => (r.day === day ? { ...r, ...patch } : r));
    onChange(next);
  };

  const monday = rows.find((r) => r.day === 'mon');
  const canApplyToWeekdays = !!(monday?.from || monday?.to);
  const applyMondayToWeekdays = () => {
    if (!monday) return;
    const weekdays: DayId[] = ['tue', 'wed', 'thu', 'fri'];
    const next = rows.map((r) =>
      weekdays.includes(r.day) ? { ...r, from: monday.from, to: monday.to } : r
    );
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E7E7EA] bg-[#F5F5F6] px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#0a0a0a]">
            Total per week
          </p>
          <p className="mt-0.5 text-xl font-bold text-[#0a0a0a]">
            {fmt(weekly)} <span className="text-sm font-medium">hrs</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#0a0a0a]">
            Total per month
          </p>
          <p className="mt-0.5 text-xl font-bold text-[#0a0a0a]">
            {fmt(monthly)} <span className="text-sm font-medium">hrs</span>
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {rows.map((row) => {
          const day = DAYS.find((d) => d.id === row.day)!;
          const hrs = dailyHours(row.from, row.to);
          return (
            <div key={row.day}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
                <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700">
                  {day.label}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={row.from}
                    onChange={(e) => update(row.day, { from: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                    aria-label={`${day.label} from time`}
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="time"
                    value={row.to}
                    onChange={(e) => update(row.day, { to: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]"
                    aria-label={`${day.label} to time`}
                  />
                </div>
                <div className="w-20 flex-shrink-0 text-right text-sm font-medium text-gray-600">
                  {row.from && row.to && hrs > 0 ? `${fmt(hrs)} hrs` : ''}
                </div>
              </div>
              {row.day === 'mon' && canApplyToWeekdays && (
                <div className="flex justify-end px-4 pb-3 -mt-1">
                  <button
                    type="button"
                    onClick={applyMondayToWeekdays}
                    className="text-xs font-medium text-[#0a0a0a] hover:text-[#0a0a0a]"
                  >
                    Apply to all weekdays (Tue–Fri)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
