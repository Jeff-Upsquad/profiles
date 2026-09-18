'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export interface ChecklistItem {
  key: string;
  section: string;
  label: string;
  message: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  categoryId: string | null | undefined;
  talentName?: string | null;
  talentPhone?: string | null;
  onDone?: () => void;
}

/**
 * "Request changes" — the middle path between Approve and Reject. The reviewer
 * ticks checklist items (shared list from Settings + this category's form
 * fields), optionally adds a free-text line, and the talent gets the list
 * in-app plus a WhatsApp template via the SquadHire CRM.
 */
export default function RequestChangesDialog({
  isOpen,
  onClose,
  profileId,
  categoryId,
  talentName,
  talentPhone,
  onDone,
}: Props) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [other, setOther] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [filter, setFilter] = useState('');

  const { data: items, isLoading } = useQuery<ChecklistItem[]>({
    queryKey: ['review-checklist', categoryId ?? 'none'],
    queryFn: async () => {
      const { data } = await api.get('/admin/reviews/checklist', {
        params: categoryId ? { category_id: categoryId } : {},
      });
      return data.items ?? [];
    },
    enabled: isOpen,
  });

  const sections = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, ChecklistItem[]>();
    for (const it of items ?? []) {
      if (q && !`${it.label} ${it.message}`.toLowerCase().includes(q)) continue;
      const arr = map.get(it.section) ?? [];
      arr.push(it);
      map.set(it.section, arr);
    }
    return [...map.entries()];
  }, [items, filter]);

  const reset = () => {
    setPicked(new Set());
    setNotes({});
    setOther('');
    setFilter('');
    setSendWhatsapp(true);
  };

  const send = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/admin/reviews/${profileId}/request-changes`, {
        keys: [...picked],
        notes,
        other: other.trim() || null,
        send_whatsapp: sendWhatsapp,
      });
      return data.profile as { changes_whatsapp_sent: boolean | null };
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', profileId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-hub'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-journey'] });
      if (p.changes_whatsapp_sent === true) {
        toast.success('Changes requested · WhatsApp sent');
      } else if (p.changes_whatsapp_sent === false) {
        toast.success('Changes requested · WhatsApp not sent (map the event in CRM → System Automation)', {
          duration: 6000,
        });
      } else {
        toast.success('Changes requested');
      }
      reset();
      onClose();
      onDone?.();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to request changes'),
  });

  const count = picked.size + (other.trim() ? 1 : 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!send.isPending) onClose();
      }}
      title="Request changes"
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Tick what {talentName ? <span className="font-medium text-gray-900">{talentName}</span> : 'the talent'} needs
          to fix. The profile leaves your queue until they tap <span className="font-medium">Resubmit for review</span>.
        </p>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter items…"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-gray-500">No checklist items match.</p>
          ) : (
            sections.map(([section, list]) => (
              <div key={section}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{section}</p>
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
                  {list.map((it) => {
                    const on = picked.has(it.key);
                    return (
                      <li key={it.key} className={`px-3 py-2 ${on ? 'bg-amber-50/60' : 'bg-white'}`}>
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setPicked((prev) => {
                                const n = new Set(prev);
                                if (n.has(it.key)) n.delete(it.key);
                                else n.add(it.key);
                                return n;
                              })
                            }
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-gray-900">{it.label}</span>
                            <span className="block text-xs text-gray-500">{it.message}</span>
                          </span>
                        </label>
                        {on && (
                          <input
                            type="text"
                            value={notes[it.key] ?? ''}
                            onChange={(e) => setNotes((n) => ({ ...n, [it.key]: e.target.value }))}
                            placeholder="Add a specific note (optional)"
                            className="mt-2 ml-7 block w-[calc(100%-1.75rem)] rounded-md border border-gray-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Other</p>
            <textarea
              rows={2}
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="Describe anything not covered above…"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={sendWhatsapp}
            onChange={(e) => setSendWhatsapp(e.target.checked)}
            disabled={!talentPhone}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          Send WhatsApp via CRM{talentPhone ? ` (${talentPhone})` : ' — no phone on file'}
        </label>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
          <span className="text-xs text-gray-500">
            {count === 0 ? 'Nothing selected' : `${count} item${count === 1 ? '' : 's'} selected`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={send.isPending}>
              Cancel
            </Button>
            <Button loading={send.isPending} disabled={count === 0} onClick={() => send.mutate()}>
              Send request
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
