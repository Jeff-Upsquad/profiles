/** Calendar YYYY-MM-DD in the given IANA timezone (local zone when omitted). */
function ymd(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function nextYmd(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function groupMeetDayLabel(iso: string, timeZone?: string): 'Today' | 'Tomorrow' | null {
  try {
    const meeting = ymd(new Date(iso), timeZone);
    const today = ymd(new Date(), timeZone);
    if (meeting === today) return 'Today';
    if (meeting === nextYmd(today)) return 'Tomorrow';
    return null;
  } catch {
    return null;
  }
}

function withZone(iso: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions, dateOnly = false): string {
  const date = new Date(iso);
  const opts = timeZone ? { ...options, timeZone } : options;
  try {
    return dateOnly ? date.toLocaleDateString('en-IN', opts) : date.toLocaleString('en-IN', opts);
  } catch {
    return dateOnly ? date.toLocaleDateString('en-IN', options) : date.toLocaleString('en-IN', options);
  }
}

export function formatGroupMeetTimeRange(startIso: string, endIso: string, timeZone?: string): string {
  const start = withZone(startIso, timeZone, { hour: 'numeric', minute: '2-digit' });
  const end = withZone(endIso, timeZone, { hour: 'numeric', minute: '2-digit' });
  return `${start} – ${end}`;
}

function prefixRelative(iso: string, formatted: string, timeZone?: string): string {
  const relative = groupMeetDayLabel(iso, timeZone);
  return relative ? `${relative}, ${formatted}` : formatted;
}

export function formatGroupMeetDate(iso: string, timeZone?: string): string {
  return prefixRelative(iso, withZone(iso, timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }, true), timeZone);
}

export function formatGroupMeetWhen(iso: string, timeZone?: string): string {
  return prefixRelative(iso, withZone(iso, timeZone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }), timeZone);
}

export function formatGroupMeetNoticeWhen(iso: string, timeZone?: string): string {
  return prefixRelative(iso, withZone(iso, timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), timeZone);
}
