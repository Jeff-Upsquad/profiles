/**
 * Pairing pre-sync training pages with the ones SquadHub sends.
 *
 * A course built before content moved to SquadHub carries no SquadHub ids. The
 * first time it is linked and published, its pages have to be recognised in the
 * incoming payload rather than duplicated beside it: talents' progress hangs off
 * the page ids we already have, and so do the module locks.
 *
 * Matching walks the tree from the roots down and pairs on parent + title, so
 * the two pages a course may well have called "Basic Profile" — one the section,
 * one the lesson inside it — can't be mistaken for one another. Anything that
 * finds no partner is left alone: adoption never destroys a page.
 */

export interface AdoptableLegacyPage {
  id: string;
  parent_page_id: string | null;
  title: string;
}

export interface AdoptableIncomingPage {
  id: string;
  parent_id: string | null;
  title: string;
}

/** Titles are matched leniently — case, padding and inner spacing don't count. */
export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Pair incoming pages with the legacy ones they replace.
 *
 * `existingByRemote` (SquadHub page id → our page id) is extended in place with
 * every pair found, which is what makes the caller update those rows instead of
 * inserting new ones. Returns the local ids that were adopted.
 */
export function adoptLegacyPages(
  pages: AdoptableIncomingPage[],
  legacyRows: AdoptableLegacyPage[],
  existingByRemote: Map<string, string>,
): string[] {
  if (legacyRows.length === 0) return [];

  const legacyByParent = new Map<string | null, AdoptableLegacyPage[]>();
  for (const row of legacyRows) {
    const list = legacyByParent.get(row.parent_page_id) ?? [];
    list.push(row);
    legacyByParent.set(row.parent_page_id, list);
  }

  const incomingByParent = new Map<string | null, AdoptableIncomingPage[]>();
  for (const page of pages) {
    const list = incomingByParent.get(page.parent_id) ?? [];
    list.push(page);
    incomingByParent.set(page.parent_id, list);
  }

  const taken = new Set<string>();
  const adopted: string[] = [];

  const walk = (page: AdoptableIncomingPage, parentLocalId: string | null) => {
    const candidates = legacyByParent.get(parentLocalId) ?? [];
    const match = candidates.find(
      (row) => !taken.has(row.id) && normalizeTitle(row.title) === normalizeTitle(page.title),
    );
    // No partner here, so nothing below it has one either: a page whose parent
    // is new content belongs to the new tree, not the old one.
    if (!match) return;
    taken.add(match.id);
    adopted.push(match.id);
    existingByRemote.set(page.id, match.id);
    for (const child of incomingByParent.get(page.id) ?? []) walk(child, match.id);
  };

  const present = new Set(pages.map((p) => p.id));
  for (const page of pages) {
    if (!page.parent_id || !present.has(page.parent_id)) walk(page, null);
  }
  return adopted;
}
