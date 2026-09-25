'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import {
  useKnowledgeCategories,
  useKnowledgeItem,
  useKnowledgeItems,
  useKnowledgeSuggestions,
  type KnowledgeCategory,
} from '@/hooks/useKnowledge';

// SquadHub Resources → Knowledge, where the content is written.
const SQUADHUB_RESOURCES_URL = 'https://admin.squadhub.in/admin/learning';

/** "8 June 2026" — the house date format. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function CategoryChips({ keys, labels }: { keys: string[]; labels: Map<string, string> }) {
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span
          key={k}
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            k === 'general' ? 'bg-blue-50 text-blue-700' : k === 'tech' ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {labels.get(k) ?? k}
        </span>
      ))}
    </div>
  );
}

function ItemReader({ id, labels, onClose }: { id: string; labels: Map<string, string>; onClose: () => void }) {
  const { data: item, isLoading } = useKnowledgeItem(id);
  return (
    <Modal isOpen onClose={onClose} title={item?.title ?? 'Loading…'} size="lg">
      {isLoading || !item ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CategoryChips keys={item.categories} labels={labels} />
            <a
              href={item.edit_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Edit in SquadHub ↗
            </a>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">What Squad Bot reads</p>
            <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
              {item.body_text}
            </div>
          </div>
          <p className="text-xs text-gray-400">Last synced from SquadHub {formatDate(item.synced_at)}</p>
        </div>
      )}
    </Modal>
  );
}

function KnowledgeList({ categories }: { categories: KnowledgeCategory[] }) {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items, isLoading } = useKnowledgeItems(category, q);
  const labels = useMemo(() => new Map(categories.map((c) => [c.key, c.label])), [categories]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategory('')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!category ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${category === c.key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {c.label} <span className="opacity-60">{c.count}</span>
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search questions and answers…"
        className="mb-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !items?.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-gray-700">
            {q || category ? 'Nothing matches.' : 'No knowledge yet.'}
          </p>
          {!q && !category && (
            <p className="mt-1 text-sm text-gray-500">
              Write it in SquadHub Resources → New content → Knowledge, pick its categories and publish. It appears here within a few seconds.
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {items.map((item) => (
            <li key={item.id}>
              <button onClick={() => setOpenId(item.id)} className="block w-full px-4 py-3 text-left hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-gray-900">
                    {item.icon ? `${item.icon} ` : ''}
                    {item.title}
                  </p>
                  <CategoryChips keys={item.categories} labels={labels} />
                </div>
                {item.snippet && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{item.snippet}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <ItemReader id={openId} labels={labels} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PendingApprovals() {
  const { data: suggestions, isLoading } = useKnowledgeSuggestions();
  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!suggestions?.length) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-700">Nothing waiting for approval.</p>
        <p className="mt-1 text-sm text-gray-500">
          When Squad Bot hands a question to the team and it gets answered, the bot drafts a new entry here for you to approve before it becomes knowledge.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {suggestions.map((s) => (
        <li key={s.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="font-medium text-gray-900">{s.question}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{s.answer}</p>
          <p className="mt-2 text-xs text-gray-400">Suggested {formatDate(s.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}

export default function KnowledgeCenter() {
  const [tab, setTab] = useState<'knowledge' | 'pending'>('knowledge');
  const { data: categories = [], isLoading } = useKnowledgeCategories();
  const { data: suggestions } = useKnowledgeSuggestions();
  const pending = suggestions?.length ?? 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            What Squad Bot knows when it answers talents. Written and edited in SquadHub Resources.
          </p>
        </div>
        <a
          href={SQUADHUB_RESOURCES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Open SquadHub Resources ↗
        </a>
      </div>

      <div className="mb-5 flex gap-6 border-b border-gray-200">
        {([
          ['knowledge', 'Knowledge'],
          ['pending', `Pending approvals${pending ? ` (${pending})` : ''}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'knowledge' ? (
        isLoading ? <p className="text-sm text-gray-500">Loading…</p> : <KnowledgeList categories={categories} />
      ) : (
        <PendingApprovals />
      )}
    </div>
  );
}
