import { normalizeBusinessLink } from '../../../shared/src/businessLinks';

export function splitTextLinks(text: string): { text: string; href?: string }[] {
  const parts: { text: string; href?: string }[] = [];
  const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    let candidate = match[0].replace(/[.,!?;:]+$/, '');
    // Keep balanced parentheses in URLs, but leave prose punctuation outside.
    while (candidate.endsWith(')') && (candidate.match(/\)/g)?.length ?? 0) > (candidate.match(/\(/g)?.length ?? 0)) candidate = candidate.slice(0, -1);
    const href = normalizeBusinessLink(candidate);
    if (!href) continue;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: candidate, href });
    cursor = start + candidate.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
