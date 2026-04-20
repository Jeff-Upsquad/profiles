/**
 * Groups a list of items (with a date field) into time-bucketed sections:
 *  1. "Today" / "Yesterday" / weekday name (e.g. "Wednesday") — for the past 7 calendar days
 *  2. "Earlier this month"                                    — this calendar month, excluding those 7 days
 *  3. "March 2026"                                            — older entries grouped by month
 *
 * Items must already be sorted newest-first by the same date field.
 */
export interface DatedItem {
  created_at: string;
}

export interface LeadBucket<T> {
  key: string;
  label: string;
  items: T[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function groupItemsByBucket<T extends DatedItem>(items: T[]): LeadBucket<T>[] {
  if (!items.length) return [];

  const now = new Date();
  const todayStart = startOfDay(now);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets = new Map<string, LeadBucket<T>>();
  const pushTo = (key: string, label: string, item: T) => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, label, items: [] };
      buckets.set(key, b);
    }
    b.items.push(item);
  };

  for (const item of items) {
    const d = new Date(item.created_at);
    const diffDays = Math.floor(
      (todayStart.getTime() - startOfDay(d).getTime()) / 86_400_000
    );

    if (diffDays <= 0) {
      pushTo('day-today', 'Today', item);
    } else if (diffDays === 1) {
      pushTo('day-yesterday', 'Yesterday', item);
    } else if (diffDays <= 6) {
      const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
      // key uses day-offset so it stays unique across weeks if the window ever extends
      pushTo(`day-${diffDays}`, weekday, item);
    } else if (d >= startOfThisMonth) {
      pushTo('this-month', 'Earlier this month', item);
    } else {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      pushTo(key, label, item);
    }
  }

  // Input is newest-first, so insertion order already gives us the correct bucket order.
  return Array.from(buckets.values());
}
