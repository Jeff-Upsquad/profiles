'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDateTime } from '@/lib/formatDate';
import {
  useCourse,
  useItemPages,
  useLinkCourseToSquadhub,
  useUpdatePageConfig,
  LINKED_MODULES,
  type TrainingPageNode,
} from '@/hooks/useTraining';

/**
 * The locking screen for one course.
 *
 * Content is read-only here — it's authored in SquadHub and synced down. What
 * an admin sets on each page is the gating SquadHire owns:
 *
 *   • Unlocks module     — the talent-portal module this page opens once its
 *                          subtree is complete
 *   • Gates profile      — this page must be finished before a job profile can
 *                          be created in the course's job profiles
 *   • Visible            — hide a synced page from talents without touching
 *                          SquadHub
 *
 * A course that predates the sync has no SquadHub item behind it, so nothing
 * can edit its content. The link panel fixes that in place: pointing it at a
 * SquadHub item makes the next publish update these very pages instead of
 * creating a second copy, so progress and locks carry over.
 */

/** Accepts a bare id or a SquadHub editor link and returns the id in it. */
function extractItemId(input: string): string | null {
  const match = input
    .trim()
    .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0].toLowerCase() : null;
}

interface TreeNode extends TrainingPageNode {
  depth: number;
  children: TreeNode[];
}

/** Flat rows → tree, then back to a flat list in reading order with depth. */
function toOrderedRows(pages: TrainingPageNode[]): TreeNode[] {
  const byParent = new Map<string | null, TrainingPageNode[]>();
  for (const p of pages) {
    const list = byParent.get(p.parent_page_id) ?? [];
    list.push(p);
    byParent.set(p.parent_page_id, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.position - b.position);

  const present = new Set(pages.map((p) => p.id));
  const seen = new Set<string>();
  const out: TreeNode[] = [];

  const walk = (page: TrainingPageNode, depth: number) => {
    if (seen.has(page.id)) return; // guard against a malformed parent chain
    seen.add(page.id);
    const node: TreeNode = { ...page, depth, children: [] };
    out.push(node);
    for (const child of byParent.get(page.id) ?? []) walk(child, depth + 1);
  };

  // Pages whose parent is missing are treated as roots so nothing is hidden.
  for (const p of pages) {
    if (!p.parent_page_id || !present.has(p.parent_page_id)) walk(p, 0);
  }
  return out;
}

export default function CoursePageGating({ courseId }: { courseId: string }) {
  const { data: course, isLoading: courseLoading } = useCourse(courseId);
  const { data: pages, isLoading: pagesLoading } = useItemPages(courseId);
  const update = useUpdatePageConfig(courseId);
  const link = useLinkCourseToSquadhub(courseId);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const rows = useMemo(() => toOrderedRows(pages ?? []), [pages]);

  const submitLink = () => {
    const id = extractItemId(linkInput);
    if (!id) {
      setLinkError('That does not look like a SquadHub item id or editor link');
      return;
    }
    setLinkError(null);
    link.mutate(id, { onSuccess: () => setLinkInput('') });
  };

  const save = (pageId: string, patch: Record<string, unknown>) => {
    setSavingId(pageId);
    update.mutate(
      { pageId, ...patch },
      { onSettled: () => setSavingId(null) },
    );
  };

  if (courseLoading || pagesLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/training" className="text-sm text-gray-500 hover:text-gray-900">
          ← Training Program
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{course?.title}</h1>
            {course?.summary && (
              <p className="mt-0.5 max-w-2xl text-sm text-gray-500">{course.summary}</p>
            )}
          </div>
          {course?.squadhub_url && (
            <a href={course.squadhub_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary">Edit content in SquadHub ↗</Button>
            </a>
          )}
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Pages, videos and quizzes are written in SquadHub&rsquo;s Resources module and sync here
        automatically. This screen controls what each page <strong>unlocks</strong> for talents.
      </div>

      {course && !course.squadhub_item_id && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <p className="font-semibold">This course isn&rsquo;t linked to SquadHub yet</p>
          <p className="mt-1 text-amber-800">
            It was built before content moved to SquadHub, so nothing can edit it right now. Open the
            matching item in SquadHub Resources, copy its editor link, and paste it here. On its next
            publish the pages below are <strong>updated in place</strong> — talents keep their
            progress and your locks stay put.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitLink();
              }}
              placeholder="Paste the SquadHub editor link or item id"
              className="min-w-[22rem] flex-1 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
            />
            <Button onClick={submitLink} disabled={link.isPending || !linkInput.trim()}>
              {link.isPending ? 'Linking…' : 'Link'}
            </Button>
          </div>
          {linkError && <p className="mt-1.5 text-xs font-medium text-red-700">{linkError}</p>}
        </div>
      )}

      {course?.squadhub_item_id && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <span>
            Linked to SquadHub item <code className="text-gray-900">{course.squadhub_item_id}</code>
            {course.synced_at
              ? ` · last synced ${formatDateTime(course.synced_at)}`
              : ' · waiting for its first publish from SquadHub'}
          </span>
          <button
            onClick={() => {
              if (confirm('Unlink this course from SquadHub? Its pages and content stay as they are, but SquadHub will stop updating them.')) {
                link.mutate(null);
              }
            }}
            disabled={link.isPending}
            className="text-xs font-medium text-gray-500 underline hover:text-gray-900 disabled:opacity-60"
          >
            Unlink
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          {course?.squadhub_item_id
            ? 'This course has no pages yet. Add them in SquadHub.'
            : 'This course has not been published from SquadHub yet.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Page</th>
                <th className="px-4 py-3 font-medium">Unlocks module</th>
                <th className="px-4 py-3 font-medium">Gates profile</th>
                <th className="px-4 py-3 font-medium">Visible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((page) => {
                const busy = savingId === page.id;
                return (
                  <tr key={page.id} className={busy ? 'opacity-60' : undefined}>
                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-2"
                        style={{ paddingLeft: `${page.depth * 20}px` }}
                      >
                        {page.icon && <span aria-hidden>{page.icon}</span>}
                        <span className="font-medium text-gray-900">{page.title}</span>
                        {!page.has_content && (
                          // A page with no blocks is a heading: it holds other
                          // pages but isn't something a talent completes.
                          <Badge variant="gray">Section</Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <select
                        value={page.linked_module ?? ''}
                        disabled={busy}
                        onChange={(e) =>
                          save(page.id, { linked_module: e.target.value || null })
                        }
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
                      >
                        <option value="">—</option>
                        {LINKED_MODULES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={page.gates_profile_creation}
                        disabled={busy}
                        onChange={(e) =>
                          save(page.id, { gates_profile_creation: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-gray-300 accent-gray-900"
                      />
                    </td>

                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={page.is_active}
                        disabled={busy}
                        onChange={(e) => save(page.id, { is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 accent-gray-900"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        A module unlocks once the page and everything nested under it is complete. Sections have no
        content of their own, so they never count toward progress.
      </p>
    </div>
  );
}
