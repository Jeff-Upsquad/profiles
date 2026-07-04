// Shared work-hours helpers for the talent Basic Profile scheduling UIs
// (Virtual Office Hours + Daily Available Hours), used by
// PartnerProgramPreference for the weekly/monthly math and day metadata.

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// One office-hours window per day. Times are stored 24h "HH:MM" (or '').
export interface DayHours {
  day: DayId;
  from: string;
  to: string;
}

// Per-day committed hours for the Partner Program.
export interface DayAvailableHours {
  day: DayId;
  hours: number;
}

export const WEEKDAYS: { id: DayId; label: string; short: string }[] = [
  { id: 'mon', label: 'Monday', short: 'Mon' },
  { id: 'tue', label: 'Tuesday', short: 'Tue' },
  { id: 'wed', label: 'Wednesday', short: 'Wed' },
  { id: 'thu', label: 'Thursday', short: 'Thu' },
  { id: 'fri', label: 'Friday', short: 'Fri' },
];

export const WEEKEND: { id: DayId; label: string; short: string }[] = [
  { id: 'sat', label: 'Saturday', short: 'Sat' },
  { id: 'sun', label: 'Sunday', short: 'Sun' },
];

export const ALL_DAYS = [...WEEKDAYS, ...WEEKEND];

const TIME_RE = /^\d{2}:\d{2}$/;

export function toMinutes(t: string): number | null {
  if (!TIME_RE.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Hours between a 24h "HH:MM" from/to pair (0 if either is unset/invalid).
export function dailyHours(from: string, to: string): number {
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

// How many times a given weekday occurs in the current calendar month.
export function monthlyOccurrences(dayId: DayId, ref: Date): number {
  const target = DAY_TO_DOW[dayId];
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstOccurrenceDay = 1 + ((target - firstDow + 7) % 7);
  return Math.floor((daysInMonth - firstOccurrenceDay) / 7) + 1;
}

// Trim trailing ".0" for whole numbers.
export function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ── 12-hour time helpers (UI is 12h AM/PM; storage stays 24h "HH:MM") ──

export interface Time12 {
  hour12: number; // 1..12
  minute: number; // 0..59
  meridiem: 'AM' | 'PM';
}

// Parse a 24h "HH:MM" into 12h parts; returns null when unset/invalid.
export function parse12(hhmm: string): Time12 | null {
  const mins = toMinutes(hhmm);
  if (mins == null) return null;
  const [h, m] = hhmm.split(':').map(Number);
  const meridiem: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, meridiem };
}

// Build a 24h "HH:MM" from 12h parts.
export function build24({ hour12, minute, meridiem }: Time12): string {
  let h = hour12 % 12;
  if (meridiem === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Display a 24h "HH:MM" as e.g. "10:00 AM" ('' when unset).
export function format12(hhmm: string): string {
  const p = parse12(hhmm);
  if (!p) return '';
  return `${p.hour12}:${String(p.minute).padStart(2, '0')} ${p.meridiem}`;
}
