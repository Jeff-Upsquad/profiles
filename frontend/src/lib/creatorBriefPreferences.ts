export const ANY_CREATOR_PREFERENCE = 'Any';

/** “Any” and specific choices are mutually exclusive. */
export function toggleCreatorPreference(selected: string[], value: string): string[] {
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  if (value === ANY_CREATOR_PREFERENCE) return [ANY_CREATOR_PREFERENCE];
  return [...selected.filter((item) => item !== ANY_CREATOR_PREFERENCE), value];
}
