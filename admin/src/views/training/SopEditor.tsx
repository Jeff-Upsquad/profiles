'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateSopBlock,
  useCreateSopPage,
  useDeleteSopBlock,
  useDeleteSopPage,
  useShareSop,
  useSop,
  useSopPageBlocks,
  useSopPages,
  useSopShareStats,
  useUpdateSop,
  useUpdateSopBlock,
  useUpdateSopPage,
  type SopBlock,
  type SopPage,
} from '@/hooks/useSops';
import { usePreviewShareAudience } from '@/hooks/useTraining';

export default function SopEditor({ sopId }: { sopId: string }) {
  const { data: sop, isLoading } = useSop(sopId);
  const { data: pages = [] } = useSopPages(sopId);
  const { data: stats } = useSopShareStats(sopId);
  const updateSop = useUpdateSop();
  const createPage = useCreateSopPage(sopId);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (sop) {
      setTitle(sop.title);
      setSummary(sop.summary ?? '');
    }
  }, [sop?.id, sop?.title, sop?.summary]);

  useEffect(() => {
    if (!selectedPageId && pages.length > 0) {
      setSelectedPageId(pages[0].id);
    }
  }, [pages, selectedPageId]);

  const tree = useMemo(() => buildPageTree(pages), [pages]);

  if (isLoading || !sop) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  }

  const saveMeta = () =>
    updateSop.mutate({
      id: sopId,
      title,
      summary: summary || null,
    });

  return (
    <div className="space-y-4">
      <div>
        <Link href="/training?tab=sops" className="text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to training
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="max-w-xl text-lg font-semibold"
            />
            <Badge variant={sop.status === 'published' ? 'green' : 'gray'}>{sop.status}</Badge>
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="Short summary shown in the talent catalog"
            className="block w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={saveMeta} disabled={updateSop.isPending}>
              Save details
            </Button>
            {sop.status !== 'published' ? (
              <Button
                size="sm"
                onClick={() => updateSop.mutate({ id: sopId, status: 'published' })}
              >
                Publish
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateSop.mutate({ id: sopId, status: 'draft' })}
              >
                Unpublish
              </Button>
            )}
            <Button size="sm" onClick={() => setShareOpen(true)}>
              Share with talents
            </Button>
          </div>
        </div>
        {stats && stats.assigned > 0 && (
          <div className="grid grid-cols-3 gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs">
            <div>
              <div className="text-lg font-semibold">{stats.assigned}</div>
              <div className="text-gray-500">Assigned</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-emerald-700">{stats.completed}</div>
              <div className="text-gray-500">Done</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-amber-700">
                {stats.assigned - stats.completed}
              </div>
              <div className="text-gray-500">Open</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Page tree */}
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Pages</h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const t = prompt('Page title');
                if (t?.trim()) createPage.mutate({ title: t.trim() });
              }}
            >
              + Page
            </Button>
          </div>
          <PageTree
            nodes={tree}
            selectedId={selectedPageId}
            onSelect={setSelectedPageId}
            sopId={sopId}
            onAddChild={(parentId) => {
              const t = prompt('Subpage title');
              if (t?.trim()) createPage.mutate({ title: t.trim(), parent_page_id: parentId });
            }}
          />
        </div>

        {/* Blocks editor */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {selectedPageId ? (
            <PageBlocksEditor pageId={selectedPageId} sopId={sopId} />
          ) : (
            <p className="text-sm text-gray-500">Select a page to edit its content.</p>
          )}
        </div>
      </div>

      <Modal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share SOP with talents"
        size="lg"
      >
        <ShareSopForm
          sopId={sopId}
          defaultCategories={sop.categories?.map((c) => c.id) ?? []}
          availableToAllDefault={sop.available_to_all}
          onClose={() => setShareOpen(false)}
        />
      </Modal>
    </div>
  );
}

type TreeNode = SopPage & { children: TreeNode[] };

function buildPageTree(pages: SopPage[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const p of pages) map.set(p.id, { ...p, children: [] });
  const roots: TreeNode[] = [];
  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parent_page_id && map.has(p.parent_page_id)) {
      map.get(p.parent_page_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function PageTree({
  nodes,
  selectedId,
  onSelect,
  sopId,
  onAddChild,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  sopId: string;
  onAddChild: (parentId: string) => void;
  depth?: number;
}) {
  const deletePage = useDeleteSopPage(sopId);
  const updatePage = useUpdateSopPage(sopId);

  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => (
        <li key={n.id}>
          <div
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm ${
              selectedId === n.id ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-gray-50 text-gray-800'
            }`}
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => onSelect(n.id)}>
              {n.title}
            </button>
            <button
              type="button"
              className="hidden text-xs text-gray-400 group-hover:inline"
              title="Rename"
              onClick={() => {
                const t = prompt('Rename page', n.title);
                if (t?.trim()) updatePage.mutate({ pageId: n.id, title: t.trim() });
              }}
            >
              ✎
            </button>
            <button
              type="button"
              className="hidden text-xs text-gray-400 group-hover:inline"
              title="Add subpage"
              onClick={() => onAddChild(n.id)}
            >
              +
            </button>
            <button
              type="button"
              className="hidden text-xs text-rose-500 group-hover:inline"
              title="Delete"
              onClick={() => {
                if (confirm(`Delete page "${n.title}" and its subpages?`)) deletePage.mutate(n.id);
              }}
            >
              ×
            </button>
          </div>
          {n.children.length > 0 && (
            <PageTree
              nodes={n.children}
              selectedId={selectedId}
              onSelect={onSelect}
              sopId={sopId}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function plainTextFromBlock(block: SopBlock): string {
  const tc = block.text_content;
  if (typeof tc === 'string') return tc;
  if (tc && typeof tc === 'object' && 'text' in (tc as any)) return String((tc as any).text ?? '');
  // Tiptap-ish: { type: 'doc', content: [{ type: 'paragraph', content: [{ text }]}]}
  try {
    const doc = tc as any;
    if (doc?.content) {
      return doc.content
        .map((p: any) => (p.content ?? []).map((c: any) => c.text ?? '').join(''))
        .join('\n');
    }
  } catch {
    /* ignore */
  }
  return '';
}

function textContentPayload(text: string) {
  // Store simple doc shape compatible with a future Tiptap editor
  return {
    type: 'doc',
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function PageBlocksEditor({ pageId, sopId }: { pageId: string; sopId: string }) {
  const { data: blocks = [], isLoading } = useSopPageBlocks(pageId);
  const createBlock = useCreateSopBlock(pageId);
  const updateBlock = useUpdateSopBlock(pageId);
  const deleteBlock = useDeleteSopBlock(pageId);

  if (isLoading) return <div className="h-24 animate-pulse rounded bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold text-gray-800">Content blocks</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            createBlock.mutate({
              type: 'text',
              position: blocks.length,
              text_content: textContentPayload(''),
            })
          }
        >
          + Text
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const url = prompt('Video embed URL (Loom / SquadClips share link)');
            if (url?.trim()) {
              createBlock.mutate({
                type: 'video_embed',
                position: blocks.length,
                embed_url: url.trim(),
                embed_provider: url.includes('loom') ? 'loom' : 'other',
              });
            }
          }}
        >
          + Video
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const url = prompt('Image URL');
            if (url?.trim()) {
              createBlock.mutate({
                type: 'image',
                position: blocks.length,
                file_url: url.trim(),
              });
            }
          }}
        >
          + Image
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const url = prompt('PDF URL');
            if (url?.trim()) {
              createBlock.mutate({
                type: 'pdf',
                position: blocks.length,
                file_url: url.trim(),
                file_name: 'document.pdf',
              });
            }
          }}
        >
          + PDF
        </Button>
      </div>

      {blocks.length === 0 && (
        <p className="text-sm text-gray-500">No blocks yet. Add text, video, image, or PDF.</p>
      )}

      {blocks.map((block) => (
        <div key={block.id} className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="gray">{block.type}</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('Delete this block?')) deleteBlock.mutate(block.id);
              }}
            >
              Delete
            </Button>
          </div>
          {block.type === 'text' && (
            <textarea
              defaultValue={plainTextFromBlock(block)}
              rows={5}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              onBlur={(e) =>
                updateBlock.mutate({
                  blockId: block.id,
                  text_content: textContentPayload(e.target.value),
                })
              }
            />
          )}
          {block.type === 'video_embed' && (
            <Input
              label="Embed URL"
              defaultValue={block.embed_url ?? ''}
              onBlur={(e) =>
                updateBlock.mutate({ blockId: block.id, embed_url: e.target.value.trim() })
              }
            />
          )}
          {(block.type === 'image' || block.type === 'pdf') && (
            <Input
              label="File URL"
              defaultValue={block.file_url ?? ''}
              onBlur={(e) =>
                updateBlock.mutate({ blockId: block.id, file_url: e.target.value.trim() })
              }
            />
          )}
          {block.type === 'image' && block.file_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.file_url} alt="" className="mt-2 max-h-48 rounded border" />
          )}
        </div>
      ))}
      {/* sopId reserved for future page-level ops */}
      <span className="hidden">{sopId}</span>
    </div>
  );
}

function ShareSopForm({
  sopId,
  defaultCategories,
  availableToAllDefault,
  onClose,
}: {
  sopId: string;
  defaultCategories: string[];
  availableToAllDefault: boolean;
  onClose: () => void;
}) {
  const { data: categories = [] } = useCategories();
  const shareMutation = useShareSop();
  const previewMutation = usePreviewShareAudience();
  const [availableToAll, setAvailableToAll] = useState(availableToAllDefault);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(defaultCategories);
  const [notify, setNotify] = useState(true);
  const [reack, setReack] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [result, setResult] = useState<{
    recipient_count: number;
    notified: number;
    reopened: number;
  } | null>(null);

  useEffect(() => {
    if (!availableToAll && selectedCategoryIds.length === 0) {
      setPreviewCount(null);
      return;
    }
    let cancelled = false;
    previewMutation
      .mutateAsync({
        available_to_all: availableToAll,
        category_ids: availableToAll ? [] : selectedCategoryIds,
      })
      .then((r) => {
        if (!cancelled) setPreviewCount(r.count);
      })
      .catch(() => {
        if (!cancelled) setPreviewCount(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableToAll, selectedCategoryIds.join(',')]);

  if (result) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Shared with {result.recipient_count} · notified {result.notified}
          {result.reopened ? ` · reopened ${result.reopened}` : ''}
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  const audienceValid = availableToAll || selectedCategoryIds.length > 0;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={availableToAll}
          onChange={(e) => setAvailableToAll(e.target.checked)}
          className="rounded border-gray-300"
        />
        Everyone (all active talents)
      </label>
      {!availableToAll && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedCategoryIds.includes(cat.id)}
                onChange={() =>
                  setSelectedCategoryIds((prev) =>
                    prev.includes(cat.id) ? prev.filter((x) => x !== cat.id) : [...prev, cat.id],
                  )
                }
                className="rounded border-gray-300"
              />
              {cat.name}
            </label>
          ))}
        </div>
      )}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
        {previewCount !== null && audienceValid
          ? `Will reach ${previewCount} talent${previewCount === 1 ? '' : 's'}`
          : 'Select audience'}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="rounded border-gray-300" />
        Send in-app notification
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={reack} onChange={(e) => setReack(e.target.checked)} className="rounded border-gray-300" />
        Require re-ack from those who already completed
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!audienceValid || shareMutation.isPending || previewCount === 0}
          onClick={async () => {
            try {
              const res = await shareMutation.mutateAsync({
                sopId,
                available_to_all: availableToAll,
                category_ids: availableToAll ? undefined : selectedCategoryIds,
                notify,
                reack,
              });
              setResult(res);
            } catch {
              /* toast */
            }
          }}
        >
          {shareMutation.isPending ? 'Sharing…' : 'Share'}
        </Button>
      </div>
    </div>
  );
}
