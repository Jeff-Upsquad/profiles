'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCompleteSop, useSopDetail, type SopPage } from '@/hooks/useTraining';
import ContentBlocks, { collectHeadings, type OutlineHeading } from './ContentBlocks';

type TreeNode = SopPage & { children: TreeNode[] };

function buildTree(pages: SopPage[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const p of pages) map.set(p.id, { ...p, children: [] });
  const roots: TreeNode[] = [];
  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parent_page_id && map.has(p.parent_page_id)) {
      map.get(p.parent_page_id)!.children.push(node);
    } else roots.push(node);
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/** Left rail — page tree with completion dots, same language as the course reader. */
function PageRail({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => {
        const isActive = n.id === selectedId;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              title={n.title}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition ${
                isActive ? 'bg-[#0a0a0a] text-white' : 'text-[#0a0a0a] hover:bg-[#F0F0F0]'
              }`}
              style={{ marginLeft: depth * 12 }}
            >
              <span
                className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold ${
                  n.completed
                    ? 'bg-emerald-500 text-white'
                    : isActive
                      ? 'bg-white text-[#0a0a0a]'
                      : 'bg-[#E7E7EA] text-[#525252]'
                }`}
              >
                {n.completed ? '✓' : '•'}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-snug">
                {n.icon ? `${n.icon} ` : ''}
                {n.title}
              </span>
            </button>
            {n.children.length > 0 && (
              <PageRail nodes={n.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Right rail — jump list built from the page's heading blocks. */
function SopOutline({
  headings,
  scrollRef,
  scanKey,
}: {
  headings: OutlineHeading[];
  scrollRef: React.RefObject<HTMLElement | null>;
  scanKey: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || headings.length === 0) {
      setActiveId(null);
      return;
    }
    const onScroll = () => {
      const rootTop = root.getBoundingClientRect().top;
      let current = headings[0].id;
      for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - rootTop <= 88) current = heading.id;
        else break;
      }
      setActiveId(current);
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [scrollRef, headings, scanKey]);

  const jumpTo = (id: string) => {
    const root = scrollRef.current;
    const el = document.getElementById(id);
    if (!root || !el) return;
    const top =
      el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - 16;
    root.scrollTo({ top, behavior: 'smooth' });
    setActiveId(id);
  };

  return (
    <div className="px-3 py-4">
      <div className="px-1.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
        On this page
      </div>
      {headings.length === 0 ? (
        <p className="px-1.5 py-2 text-[11.5px] leading-snug text-[#a3a3a3]">
          No sections on this page.
        </p>
      ) : (
        <ul className="border-l border-[#E7E7EA]">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            return (
              <li key={heading.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(heading.id)}
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                  className={`-ml-px block w-full border-l py-2 pr-2 text-left text-[12px] leading-snug transition ${
                    isActive
                      ? 'border-[#0a0a0a] font-semibold text-[#0a0a0a]'
                      : 'border-transparent text-[#737373] hover:border-[#E7E7EA] hover:text-[#0a0a0a]'
                  }`}
                >
                  {heading.text}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SopReader({
  sopId,
  onClose,
}: {
  sopId: string;
  onClose: () => void;
}) {
  const { data: sop, isLoading, error } = useSopDetail(sopId);
  const completeMutation = useCompleteSop();
  const [pageId, setPageId] = useState<string | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  const flatPages = useMemo(() => sop?.pages ?? [], [sop?.pages]);
  const tree = useMemo(() => buildTree(flatPages), [flatPages]);

  useEffect(() => {
    if (!pageId && flatPages.length > 0) setPageId(flatPages[0].id);
  }, [flatPages, pageId]);

  // Switching pages starts the new one at the top of its own column.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [pageId]);

  const pageIndex = Math.max(
    0,
    flatPages.findIndex((p) => p.id === (pageId ?? flatPages[0]?.id)),
  );
  const page = flatPages[pageIndex] ?? flatPages[0];
  // Every content page read means the SOP is done. Pages with no blocks are
  // headings and don't count, matching how progress is tracked server-side.
  const contentPages = flatPages.filter((p) => (p.blocks ?? []).length > 0);
  const doneCount = contentPages.filter((p) => p.completed).length;
  const completed = contentPages.length > 0 && doneCount >= contentPages.length;
  const pct = contentPages.length > 0 ? Math.min(100, Math.round((100 * doneCount) / contentPages.length)) : 0;

  const outline = useMemo(() => collectHeadings(page?.blocks), [page?.blocks]);

  const goTo = (index: number) => {
    const target = flatPages[index];
    if (target) setPageId(target.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[min(900px,92vh)] sm:rounded-2xl">
        {/* Top bar */}
        <div className="flex min-h-[52px] shrink-0 items-center gap-2 border-b border-[#E7E7EA] bg-white px-4 py-2.5 md:px-5">
          <button
            type="button"
            onClick={onClose}
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-md text-[#525252] transition hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            aria-label="Close"
            title="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-[15px] leading-none">{sop?.icon ?? '📄'}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[#0a0a0a]">
              {sop?.title ?? 'Loading…'}
            </span>
            <span className="hidden truncate text-[10.5px] text-[#a3a3a3] sm:block">
              Guide
              {sop?.summary ? ` · ${sop.summary}` : ''}
            </span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="text-[11px] tabular-nums text-[#525252]">{pct}%</span>
              <span className="h-1 w-24 overflow-hidden rounded-full bg-[#E7E7EA]">
                <span
                  className={`block h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-[#0a0a0a]'}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOutlineOpen((o) => !o)}
              aria-pressed={outlineOpen}
              title={outlineOpen ? 'Hide page outline' : 'Show page outline'}
              className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium transition sm:inline-flex ${
                outlineOpen
                  ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                  : 'border-[#E7E7EA] bg-white text-[#525252] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M4 6h10M4 12h16M4 18h7" />
              </svg>
              Outline
            </button>
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[#737373]">Loading…</div>
        ) : error || !sop ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-rose-600">
            Could not load this SOP.
          </div>
        ) : flatPages.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-sm text-[#737373]">
            No pages yet.
          </div>
        ) : (
          <>
            {/* Mobile page picker — stands in for the left rail on small screens */}
            <div className="shrink-0 border-b border-[#E7E7EA] bg-[#FAFAFA] px-3 py-2 sm:hidden">
              <label className="sr-only" htmlFor="sop-page-picker">Page</label>
              <select
                id="sop-page-picker"
                value={page?.id ?? ''}
                onChange={(e) => setPageId(e.target.value)}
                className="w-full rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-[13px] font-medium text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
              >
                {flatPages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.completed ? '✓ ' : ''}{p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* left rail | page | on-this-page */}
            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[232px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 overflow-y-auto border-r border-[#E7E7EA] bg-[#FAFAFA] sm:block">
                <div className="px-3 py-4">
                  <div className="flex items-center justify-between px-1.5 pb-2">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#a3a3a3]">
                      Pages
                    </span>
                    <span className="text-[10.5px] tabular-nums text-[#a3a3a3]">
                      {doneCount}/{contentPages.length}
                    </span>
                  </div>
                  <div className="mx-1.5 mb-3 h-1 overflow-hidden rounded-full bg-[#E7E7EA]">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-[#0a0a0a]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <PageRail nodes={tree} selectedId={page?.id ?? ''} onSelect={setPageId} />
                </div>
              </aside>

              <div className="relative grid min-h-0 min-w-0 grid-cols-1">
                <main ref={contentRef} className="min-h-0 min-w-0 overflow-y-auto scroll-smooth bg-white">
                  <article className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                      {sop.title}
                    </p>
                    <p className="mt-2 text-[12px] font-medium uppercase tracking-wider text-[#525252]">
                      Page {pageIndex + 1} of {flatPages.length}
                    </p>
                    <h1 className="font-[family-name:var(--font-jakarta)] mt-1 text-[24px] font-semibold leading-tight tracking-[-0.015em] text-[#0a0a0a] sm:text-[28px]">
                      {page?.title}
                    </h1>

                    <div className="mt-5">
                      <ContentBlocks blocks={page?.blocks} />
                      {(page?.blocks ?? []).length === 0 && (
                        <p className="text-sm text-[#737373]">No content on this page yet.</p>
                      )}
                    </div>

                    <div className="mt-10 flex items-center justify-between gap-3 border-t border-[#E7E7EA] pt-6">
                      <button
                        type="button"
                        onClick={() => goTo(pageIndex - 1)}
                        disabled={pageIndex <= 0}
                        className="rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#F5F5F6] disabled:opacity-30"
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        disabled={completed || completeMutation.isPending || !sop}
                        onClick={() => completeMutation.mutate(sopId)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.97] ${
                          completed
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100'
                            : 'bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]/85'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {completed ? (
                          <>✓ Completed</>
                        ) : completeMutation.isPending ? (
                          <>Saving…</>
                        ) : (
                          <>Mark as complete</>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => goTo(pageIndex + 1)}
                        disabled={pageIndex >= flatPages.length - 1}
                        className="rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#F5F5F6] disabled:opacity-30"
                      >
                        Next →
                      </button>
                    </div>
                  </article>
                </main>

                {outlineOpen && (
                  <aside className="absolute inset-y-0 right-0 z-20 w-[264px] max-w-[85%] overflow-y-auto border-l border-[#E7E7EA] bg-[#FAFAFA] shadow-[-8px_0_24px_-12px_rgba(0,0,0,0.18)]">
                    <div className="flex items-center justify-end px-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setOutlineOpen(false)}
                        aria-label="Hide page outline"
                        className="grid h-6 w-6 place-items-center rounded-md text-[#737373] transition hover:bg-[#E7E7EA] hover:text-[#0a0a0a]"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <SopOutline headings={outline} scrollRef={contentRef} scanKey={page?.id ?? ''} />
                  </aside>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
