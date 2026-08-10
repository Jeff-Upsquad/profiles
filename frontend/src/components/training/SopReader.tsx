'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useCompleteSop,
  useSopDetail,
  type SopBlock,
  type SopPage,
} from '@/hooks/useTraining';

function videoEmbedUrl(shareUrl: string): string {
  return shareUrl.replace('/share/', '/embed/');
}

function blockText(block: SopBlock): string {
  const tc = block.text_content;
  if (typeof tc === 'string') return tc;
  try {
    const doc = tc as any;
    if (doc?.content) {
      return doc.content
        .map((p: any) => (p.content ?? []).map((c: any) => c.text ?? '').join(''))
        .join('\n\n');
    }
    if (doc?.text) return String(doc.text);
  } catch {
    /* ignore */
  }
  return '';
}

function BlockView({ block }: { block: SopBlock }) {
  if (block.type === 'text') {
    const text = blockText(block);
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[#0a0a0a]">
        {text || <span className="text-[#a3a3a3]">Empty section</span>}
      </div>
    );
  }
  if (block.type === 'video_embed' && block.embed_url) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl bg-[#09090B]">
        <iframe
          src={videoEmbedUrl(block.embed_url)}
          className="h-full w-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture"
        />
      </div>
    );
  }
  if (block.type === 'image' && block.file_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={block.file_url}
        alt={block.caption ?? ''}
        className="max-h-[480px] w-full rounded-xl border border-[#E7E7EA] object-contain bg-white"
      />
    );
  }
  if (block.type === 'pdf' && block.file_url) {
    return (
      <a
        href={block.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-[#E7E7EA] bg-white px-4 py-3 text-sm font-medium text-[#0a0a0a] hover:bg-[#F5F5F6]"
      >
        Open PDF{block.file_name ? `: ${block.file_name}` : ''}
      </a>
    );
  }
  return null;
}

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

function NavTree({
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
      {nodes.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onSelect(n.id)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedId === n.id
                ? 'bg-[#0a0a0a] text-white'
                : 'text-[#0a0a0a] hover:bg-[#F5F5F6]'
            }`}
            style={{ paddingLeft: 12 + depth * 12 }}
          >
            {n.icon ? `${n.icon} ` : ''}
            {n.title}
          </button>
          {n.children.length > 0 && (
            <NavTree nodes={n.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
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

  const tree = useMemo(() => buildTree(sop?.pages ?? []), [sop?.pages]);
  const flatPages = sop?.pages ?? [];

  useEffect(() => {
    if (!pageId && flatPages.length > 0) setPageId(flatPages[0].id);
  }, [flatPages, pageId]);

  const page = flatPages.find((p) => p.id === pageId) ?? flatPages[0];
  const completed = sop?.assignment?.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none bg-[#F5F5F6] shadow-2xl sm:h-[min(900px,92vh)] sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[#E7E7EA] bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[#737373]">
              Systems &amp; Procedures
            </p>
            <h2 className="font-[family-name:var(--font-jakarta)] truncate text-lg font-semibold text-[#0a0a0a]">
              {sop?.icon ? `${sop.icon} ` : ''}
              {sop?.title ?? 'Loading…'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#525252] hover:bg-[#F5F5F6]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#737373]">Loading…</div>
        ) : error || !sop ? (
          <div className="flex flex-1 items-center justify-center text-sm text-rose-600">
            Could not load this SOP.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <aside className="max-h-40 overflow-y-auto border-b border-[#E7E7EA] bg-white p-3 sm:max-h-none sm:w-56 sm:border-b-0 sm:border-r">
              <NavTree
                nodes={tree}
                selectedId={page?.id ?? ''}
                onSelect={setPageId}
              />
            </aside>
            <main className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <h3 className="font-[family-name:var(--font-jakarta)] mb-4 text-base font-semibold text-[#0a0a0a]">
                {page?.title}
              </h3>
              <div className="space-y-5">
                {(page?.blocks ?? []).map((b) => (
                  <BlockView key={b.id} block={b} />
                ))}
                {(page?.blocks ?? []).length === 0 && (
                  <p className="text-sm text-[#737373]">No content on this page yet.</p>
                )}
              </div>
            </main>
          </div>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-[#E7E7EA] bg-white px-5 py-3">
          <p className="text-xs text-[#737373]">
            {completed
              ? 'Completed — notification cleared'
              : 'Mark complete after you have reviewed the content'}
          </p>
          <button
            type="button"
            disabled={completed || completeMutation.isPending || !sop}
            onClick={() => completeMutation.mutate(sopId)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              completed
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                : 'bg-[#0a0a0a] text-white hover:bg-[#0a0a0a]/85'
            } disabled:opacity-50`}
          >
            {completed ? 'Completed' : completeMutation.isPending ? 'Saving…' : 'Mark as complete'}
          </button>
        </footer>
      </div>
    </div>
  );
}
