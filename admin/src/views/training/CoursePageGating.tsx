'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  useCourse,
  useItemPages,
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
 */

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
  const [savingId, setSavingId] = useState<string | null>(null);

  const rows = useMemo(() => toOrderedRows(pages ?? []), [pages]);

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
