// Total work experience from the basic-profile experience entries.
// Each entry is a From/To month range (both inclusive). Overlapping or
// back-to-back jobs are merged first so concurrent roles aren't double-counted.

export interface ExperienceRange {
  from_year?: number | string | null;
  from_month?: number | string | null;
  to_year?: number | string | null;
  to_month?: number | string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};

/** True when both ends are filled and To falls before From. Used by the
 *  education + experience pickers, the basic-profile save, and the API. */
export function isRangeReversed(e: ExperienceRange | null | undefined): boolean {
  const fy = num(e?.from_year);
  const fm = num(e?.from_month);
  const ty = num(e?.to_year);
  const tm = num(e?.to_month);
  if (!fy || !fm || !ty || !tm) return false;
  return ty * 12 + tm < fy * 12 + fm;
}

/** Total distinct months covered. Entries missing a From or To month/year
 *  (e.g. half-filled while the talent is typing) are skipped. */
export function totalExperienceMonths(entries: ExperienceRange[] | null | undefined): number {
  if (!Array.isArray(entries)) return 0;
  const ranges: [number, number][] = [];
  for (const e of entries) {
    const fy = num(e?.from_year);
    const fm = num(e?.from_month);
    if (!fy || !fm) continue;
    const ty = num(e?.to_year);
    const tm = num(e?.to_month);
    if (!ty || !tm) continue;
    const start = fy * 12 + (fm - 1);
    const end = ty * 12 + (tm - 1);
    if (end < start) continue;
    ranges.push([start, end]);
  }
  ranges.sort((a, b) => a[0] - b[0]);

  let total = 0;
  let cur: [number, number] | null = null;
  for (const r of ranges) {
    if (cur && r[0] <= cur[1] + 1) {
      cur[1] = Math.max(cur[1], r[1]);
    } else {
      if (cur) total += cur[1] - cur[0] + 1;
      cur = [r[0], r[1]];
    }
  }
  if (cur) total += cur[1] - cur[0] + 1;
  return total;
}

/** "2 years 3 months", "1 year", "5 months"; null when there's nothing to count. */
export function formatExperienceMonths(months: number): string | null {
  if (!months || months <= 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y) parts.push(`${y} ${y === 1 ? 'year' : 'years'}`);
  if (m) parts.push(`${m} ${m === 1 ? 'month' : 'months'}`);
  return parts.join(' ');
}

export function formatTotalExperience(entries: ExperienceRange[] | null | undefined): string | null {
  return formatExperienceMonths(totalExperienceMonths(entries));
}
