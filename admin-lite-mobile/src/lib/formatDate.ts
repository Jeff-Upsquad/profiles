// App-wide date formatting.
// Renders every user-facing date in the "8 June 2026" style so the format is
// consistent across the product. Intentionally dependency- and locale-free so
// web and React Native produce identical output.

export type DateInput = string | number | Date | null | undefined;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Format a date as "8 June 2026". Returns `fallback` for missing/invalid input. */
export function formatDate(value: DateInput, fallback = ''): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format a date and time as "8 June 2026, 3:45 PM". Returns `fallback` for missing/invalid input. */
export function formatDateTime(value: DateInput, fallback = ''): string {
  const d = toDate(value);
  if (!d) return fallback;
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${formatDate(d)}, ${hours}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}
