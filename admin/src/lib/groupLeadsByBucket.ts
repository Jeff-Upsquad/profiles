/**
 * Groups a list of items (with a date field) into time-bucketed sections:
 *  1. "Last 7 days"          — last 168 hours
 *  2. "Earlier this month"   — this calendar month, excluding the last 7 days
 *  3. Older entries grouped by month label (e.g. "March 2026")
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

export function groupItemsByBucket<T extends DatedItem>(items: T[]): LeadBucket<T>[] {
  if (!items.length) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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
    if (d >= sevenDaysAgo) {
      pushTo('last-7', 'Last 7 days', item);
    } else if (d >= startOfThisMonth) {
      pushTo('this-month', 'Earlier this month', item);
    } else {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      pushTo(key, label, item);
    }
  }

  // Preserve input ordering (which is newest-first) via insertion order of buckets.
  return Array.from(buckets.values());
}
