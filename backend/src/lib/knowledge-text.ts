// Flatten SquadHub Resources content (Tiptap docs in a page tree) to the plain
// text Squad Bot reads and the Knowledge Center searches. Pure — no I/O.

import type { SyncPage } from '../services/training-sync.service.js';

/** Plain text of a Tiptap/ProseMirror doc: one line per paragraph/heading; "- " bullets, "1. " numbered items. */
export function tiptapToText(doc: unknown): string {
  const lines: string[] = [];
  const inline = (n: any): string =>
    n?.type === 'text' ? String(n.text ?? '')
      : n?.type === 'hardBreak' ? '\n'
        : (Array.isArray(n?.content) ? n.content : []).map(inline).join('');
  const walk = (n: any, prefix: string): void => {
    if (!n || typeof n !== 'object') return;
    const children: any[] = Array.isArray(n.content) ? n.content : [];
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'codeBlock') {
      const text = inline(n).trim();
      if (text) lines.push(prefix + text);
      return;
    }
    if (n.type === 'text') {
      if (n.text?.trim()) lines.push(prefix + n.text.trim());
      return;
    }
    if (n.type === 'orderedList' || n.type === 'bulletList' || n.type === 'taskList') {
      const start = typeof n.attrs?.start === 'number' ? n.attrs.start : 1;
      children.forEach((c, i) => walk(c, n.type === 'orderedList' ? `${start + i}. ` : '- '));
      return;
    }
    // A list item's marker goes on its first paragraph only.
    const item = n.type === 'listItem' || n.type === 'taskItem';
    children.forEach((c, i) => walk(c, item && i === 0 ? prefix : ''));
  };
  walk(doc, '');
  return lines.join('\n');
}

/** Everything Squad Bot should read from an item, pages in tree order. */
export function flattenPages(title: string, summary: string | null | undefined, pages: SyncPage[]): string {
  const byParent = new Map<string | null, SyncPage[]>();
  for (const p of pages) {
    const key = p.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(p);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  const out: string[] = [title.trim()];
  if (summary?.trim()) out.push(summary.trim());
  const visit = (parent: string | null, depth: number) => {
    for (const page of byParent.get(parent) ?? []) {
      // A post's single auto-created page repeats the item title; skip that heading.
      if (!(pages.length === 1 && page.title.trim() === title.trim())) {
        out.push(`${'#'.repeat(Math.min(depth + 2, 6))} ${page.title.trim()}`);
      }
      for (const b of [...page.blocks].sort((x, y) => x.position - y.position)) {
        if (b.type === 'text') {
          const text = tiptapToText(b.text_content);
          if (text) out.push(text);
        } else if (b.caption?.trim()) {
          out.push(`[${b.type}] ${b.caption.trim()}`);
        }
      }
      visit(page.id, depth + 1);
    }
  };
  visit(null, 0);
  return out.join('\n\n');
}
