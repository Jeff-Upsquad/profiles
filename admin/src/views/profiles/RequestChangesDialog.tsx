'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  profileId?: string;
  categoryId?: string | null;
  talentName?: string | null;
  talentPhone?: string | null;
  wasApproved?: boolean;
  /**
   * Basic-profile mode: one common request per talent instead of per job
   * profile. Uses the basic checklist scope + the basic request endpoint;
   * the basic profile is always live.
   */
  basicUserId?: string;
  /**
   * Checklist keys to tick when the dialog opens (e.g. the basic-profile
   * sections still missing). Keys not in the loaded checklist are ignored.
   */
  prefillKeys?: string[];
  onDone?: () => void;
}

/**
 * "Request changes" — the middle path between Approve and Reject. The reviewer
 * ticks checklist items (shared list from Settings + this category's form
 * fields), optionally adds a free-text line, and the talent gets the list
 * in-app plus a WhatsApp template via the SquadHire CRM.
 *
 * In basic-profile mode (`basicUserId`) the same dialog drives the one common
 * basic-profile request: shared `basic.*`/`identity.*` items only, and the
 * basic profile stays live throughout.
 */
export default function RequestChangesDialog({
  isOpen,
  onClose,
  profileId,
  categoryId,
  talentName,
  talentPhone,
  wasApproved = false,
  basicUserId,
  prefillKeys,
  onDone,
}: Props) {
  const queryClient = useQueryClient();
  const isBasic = !!basicUserId;
  // The basic profile is always live, so it gets the approved-profile wording.
  const staysLive = wasApproved || isBasic;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [other, setOther] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [filter, setFilter] = useState('');

  const { data: items, isLoading } = useQuery<ChecklistItem[]>({
    queryKey: ['review-checklist', isBasic ? 'basic' : (categoryId ?? 'none')],
    queryFn: async () => {
      const { data } = await api.get('/admin/reviews/checklist', {
        params: isBasic ? { scope: 'basic' } : categoryId ? { category_id: categoryId } : {},
      });
      return data.items ?? [];
    },
    enabled: isOpen,
  });

  // Pre-tick `prefillKeys` once per open, after the checklist has loaded.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      prefilled.current = false;
      return;
    }
    if (prefilled.current || !items || !prefillKeys?.length) return;
    prefilled.current = true;
    const valid = new Set(items.map((i) => i.key));
    setPicked(new Set(prefillKeys.filter((k) => valid.has(k))));
  }, [isOpen, items, prefillKeys]);

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
      const url = isBasic
        ? `/admin/user-approvals/${basicUserId}/basic/request-changes`
        : `/admin/reviews/${profileId}/request-changes`;
      const { data } = await api.patch(url, {
        keys: [...picked],
        notes,
        other: other.trim() || null,
        send_whatsapp: sendWhatsapp,
      });
      return (isBasic ? data.basic : data.profile) as { changes_whatsapp_sent: boolean | null };
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', profileId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-hub'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-hub-stats'] });
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
          to fix. {isBasic
            ? 'The basic profile stays live; it will show under Needs attention → Needs review once they resubmit it.'
            : staysLive
              ? 'The profile will return to your review queue once they resubmit it.'
              : <>The profile leaves your queue until they tap <span className="font-medium">Resubmit for review</span>.</>}
        </p>
        {staysLive && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {isBasic
              ? 'This basic profile will remain live while the talent updates it. Their edits will be visible immediately.'
              : 'This approved profile will remain live while the talent updates it. Their edits will be visible immediately.'}
          </p>
        )}

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
