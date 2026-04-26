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
  const monthly = +(weekly * 4.33).toFixed(1);

  const update = (day: DayId, patch: Partial<DayHours>) => {
    const next = rows.map((r) => (r.day === day ? { ...r, ...patch } : r));
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Total per week
          </p>
          <p className="mt-0.5 text-xl font-bold text-indigo-900">
            {fmt(weekly)} <span className="text-sm font-medium">hrs</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
            Total per month
          </p>
          <p className="mt-0.5 text-xl font-bold text-indigo-900">
            {fmt(monthly)} <span className="text-sm font-medium">hrs</span>
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {rows.map((row) => {
          const day = DAYS.find((d) => d.id === row.day)!;
          const hrs = dailyHours(row.from, row.to);
          return (
            <div
              key={row.day}
              className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
            >
              <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-700">
                {day.label}
              </div>
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="time"
                  value={row.from}
                  onChange={(e) => update(row.day, { from: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label={`${day.label} from time`}
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="time"
                  value={row.to}
                  onChange={(e) => update(row.day, { to: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label={`${day.label} to time`}
                />
              </div>
              <div className="w-20 flex-shrink-0 text-right text-sm font-medium text-gray-600">
                {row.from && row.to && hrs > 0 ? `${fmt(hrs)} hrs` : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
