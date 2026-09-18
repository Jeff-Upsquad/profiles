'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { ChecklistItem } from './RequestChangesDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Edit the shared "Request changes" checklist (stored in admin_settings).
 * Category form fields are appended automatically and aren't edited here.
 */
export default function ReviewChecklistModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ChecklistItem[]>([]);

  const { data, isLoading } = useQuery<ChecklistItem[]>({
    queryKey: ['review-checklist', 'none'],
    queryFn: async () => (await api.get('/admin/reviews/checklist')).data.items ?? [],
    enabled: isOpen,
  });

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => (await api.put('/admin/reviews/checklist', { items: rows })).data.items,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-checklist'] });
      toast.success('Checklist saved');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save checklist'),
  });

  const update = (i: number, patch: Partial<ChecklistItem>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const add = () => {
    const key = `custom.${Date.now().toString(36)}`;
    setRows((r) => [...r, { key, section: 'Job profile', label: '', message: '' }]);
  };

  const valid = rows.length > 0 && rows.every((r) => r.label.trim() && r.message.trim() && r.section.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review checklist" size="lg">
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          These are the items reviewers can tick when requesting changes. <span className="font-medium">Label</span> is
          what the reviewer sees; <span className="font-medium">Message</span> is what the talent reads in-app and on
          WhatsApp. Form fields for each category are added automatically.
        </p>

        {isLoading ? (
          <div className="h-32 animate-pulse rounded bg-gray-100" />
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div key={r.key} className="rounded-lg border border-gray-200 bg-white p-2.5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
                  <input
                    value={r.section}
                    onChange={(e) => update(i, { section: e.target.value })}
                    placeholder="Section (e.g. Basic profile)"
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    value={r.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      const patch: Partial<ChecklistItem> = { label };
                      if (r.key.startsWith('custom.') && label) patch.key = `custom.${slug(label) || r.key.slice(7)}`;
                      update(i, patch);
                    }}
                    placeholder="Label (reviewer sees this)"
                    className="rounded-md border border-gray-200 px-2 py-1 text-sm font-medium focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <textarea
                  rows={2}
                  value={r.message}
                  onChange={(e) => update(i, { message: e.target.value })}
                  placeholder="Message the talent reads"
                  className="mt-2 block w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{r.key}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100" title="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100" title="Move down">↓</button>
                    <button type="button" onClick={() => remove(i)} className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50">Remove</button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={add}
              className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
            >
              + Add item
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>Save checklist</Button>
        </div>
      </div>
    </Modal>
  );
}
