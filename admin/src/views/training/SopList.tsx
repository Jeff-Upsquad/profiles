'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCategories';
import {
  useArchiveSop,
  useCreateSop,
  useSops,
} from '@/hooks/useSops';

export default function SopList() {
  const { data: sops, isLoading } = useSops();
  const archiveMutation = useArchiveSop();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Systems &amp; Procedures</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Wiki-style SOPs you can share with talents by job profile.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create SOP</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !sops?.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No SOPs yet</p>
            <p className="mt-1 text-sm">Create a procedure guide and share it with designers, editors, etc.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Title</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Audience</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sops.map((sop) => (
                <tr key={sop.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/training/sops/${sop.id}`}
                      className="font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      {sop.icon ? `${sop.icon} ` : ''}
                      {sop.title}
                    </Link>
                    {sop.summary && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{sop.summary}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        sop.status === 'published' ? 'green' : sop.status === 'draft' ? 'gray' : 'indigo'
                      }
                    >
                      {sop.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {sop.available_to_all ? (
                      <span className="text-xs text-gray-600">Everyone</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {sop.categories?.length
                          ? sop.categories.map((c) => (
                              <Badge key={c.id} variant="gray">
                                {c.name}
                              </Badge>
                            ))
                          : <span className="text-xs text-gray-400">—</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/training/sops/${sop.id}`}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Archive this SOP?')) archiveMutation.mutate(sop.id);
                        }}
                        disabled={archiveMutation.isPending}
                      >
                        Archive
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create SOP">
        <CreateSopForm onClose={() => setCreateOpen(false)} />
      </Modal>
    </div>
  );
}

function CreateSopForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [availableToAll, setAvailableToAll] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const { data: categories = [] } = useCategories();
  const createMutation = useCreateSop();

  const toggle = (id: string) =>
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const sop = await createMutation.mutateAsync({
        title,
        summary: summary || undefined,
        available_to_all: availableToAll,
        category_ids: availableToAll ? [] : selectedCategoryIds,
        status: 'draft',
      });
      onClose();
      window.location.href = `/training/sops/${sop.id}`;
    } catch {
      // toast
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        placeholder="e.g. How to update your Designer job profile"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Summary</label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={availableToAll}
          onChange={(e) => setAvailableToAll(e.target.checked)}
          className="rounded border-gray-300"
        />
        Available to everyone
      </label>
      {!availableToAll && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedCategoryIds.includes(cat.id)}
                onChange={() => toggle(cat.id)}
                className="rounded border-gray-300"
              />
              {cat.name}
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || createMutation.isPending}>
          {createMutation.isPending ? 'Creating…' : 'Create & edit'}
        </Button>
      </div>
    </form>
  );
}
