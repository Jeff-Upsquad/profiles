// Deep-value comparison for profile field_data diffs. Handles primitives,
// arrays (order-sensitive), and plain objects. Port of valuesChanged logic
// from admin-lite/src/views/profiles/ProfileReview.tsx.

export function valuesChanged(a: any, b: any): boolean {
  if (a === b) return false;
  if (a == null || b == null) return a !== b;
  if (typeof a !== typeof b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (valuesChanged(a[i], b[i])) return true;
    }
    return false;
  }
  if (typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (valuesChanged(a[k], b[k])) return true;
    }
    return false;
  }
  return a !== b;
}
