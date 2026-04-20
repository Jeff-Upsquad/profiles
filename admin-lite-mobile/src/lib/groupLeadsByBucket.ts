// Port of admin-lite/src/lib/groupLeadsByBucket.ts — pure JS, works in Hermes.
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
      pushTo(`day-${diffDays}`, weekday, item);
    } else if (d >= startOfThisMonth) {
      pushTo('this-month', 'Earlier this month', item);
    } else {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      pushTo(key, label, item);
    }
  }

  return Array.from(buckets.values());
}
