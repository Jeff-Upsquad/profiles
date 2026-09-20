export const PARTNER = 'UpSquad Partner Program';
export const JOB = 'Job';

export function workIntent(values: readonly string[] | null | undefined) {
  const selected = new Set(values ?? []);
  return {
    partner: selected.has(PARTNER),
    jobs: selected.has(JOB) || selected.has('Full Time Job') || selected.has('Part Time Job'),
  };
}
