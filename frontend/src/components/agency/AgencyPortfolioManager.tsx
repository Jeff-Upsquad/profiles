'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { agencyApi } from '@/services/agency-api';
import { PortfolioThumbnail } from './AgencyPortfolioGrid';
import Button from '@/components/ui/Button';

type PortfolioItem = {
  id: string;
  title?: string;
  file_name?: string;
  member_profile_id?: string;
  hidden_from_agency?: boolean;
  [key: string]: unknown;
};

export default function AgencyPortfolioManager({ items }: { items: PortfolioItem[] }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<PortfolioItem[] | null>(null);
  const displayed = draft ?? items;
  const save = useMutation({
    mutationFn: () => agencyApi.savePortfolioCuration(displayed.map((item, index) => ({
      id: item.id, sort_order: index, hidden_from_agency: !!item.hidden_from_agency,
    }))),
    onSuccess: async () => {
      await Promise.all(['agencyTotal', 'agencyPreview', 'agency-public-view', 'agency-member-public-view', 'agencyPortfolio'].map(key => qc.invalidateQueries({ queryKey: [key] })));
      setDraft(null);
      toast.success('Agency portfolio updated');
    },
    onError: () => toast.error('Could not save your changes. Please try again.'),
  });
  function move(index: number, direction: number) {
    const next = [...displayed];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setDraft(next);
  }
  const hidden = displayed.filter(item => item.hidden_from_agency).length;

  return (
    <section id="manage-portfolio" className="scroll-mt-6 rounded-2xl border border-[#E7E7EA] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#0a0a0a]">Manage agency portfolio</h2>
      <p className="mt-1 text-sm text-[#737373]">Move items to change their order, or hide them from your agency profile. Partners’ portfolios stay visible in direct business-to-partner views.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-[#737373]">{displayed.length - hidden} visible · {hidden} hidden{draft ? ' · Unsaved changes' : ''}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!draft || save.isPending} onClick={() => setDraft(null)}>Cancel</Button>
          <Button disabled={!draft || save.isPending} loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
        </div>
      </div>
      {displayed.length === 0 && <p className="mt-5 text-sm text-[#737373]">No items yet — add one above.</p>}
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayed.map((item, index) => (
          <li key={item.id} className={`overflow-hidden rounded-xl border ${item.hidden_from_agency ? 'border-dashed border-zinc-300 bg-zinc-50' : 'border-[#E7E7EA] bg-white'}`}>
            <div className="relative aspect-video overflow-hidden bg-zinc-100">
              <PortfolioThumbnail item={item} />
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">{index + 1}</span>
              {item.hidden_from_agency && <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-medium">Hidden from agency</span>}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium" title={item.title || item.file_name}>{item.title || item.file_name || 'Untitled'}</p>
              <p className="mt-1 text-xs text-[#737373]">{item.member_profile_id ? 'Member portfolio' : 'General portfolio'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={index === 0 || save.isPending} aria-label={`Move ${item.title || item.file_name || 'item'} earlier`} onClick={() => move(index, -1)} className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-30">↑ Earlier</button>
                <button type="button" disabled={index === displayed.length - 1 || save.isPending} aria-label={`Move ${item.title || item.file_name || 'item'} later`} onClick={() => move(index, 1)} className="rounded-lg border px-2 py-1.5 text-xs disabled:opacity-30">↓ Later</button>
                <button type="button" disabled={save.isPending} aria-pressed={!!item.hidden_from_agency} onClick={() => setDraft(displayed.map(it => it.id === item.id ? { ...it, hidden_from_agency: !it.hidden_from_agency } : it))} className="rounded-lg border px-2 py-1.5 text-xs font-medium hover:bg-[#FFFAC2] disabled:opacity-30">{item.hidden_from_agency ? 'Show on agency' : 'Hide from agency'}</button>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
