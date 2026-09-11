'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SERVICE_SQUADS,
  liveItemCount,
  type Squad,
  type SquadItem,
} from '@/data/serviceSquads';
import type { ConnectBriefCategoryId } from './categories';

export type PickedCategory = {
  brief: ConnectBriefCategoryId;
  briefRole?: 'designer' | 'editor';
  itemId: string;
  squadId: string;
};

/**
 * Android-style category browser: a sticky rail of squads across the top and a
 * single scrolling panel of the categories inside the selected squad. Bookable
 * categories open a brief form; everything else opens a "coming soon" sheet.
 */
export default function SquadCategoryPicker({
  product,
  onPick,
}: {
  product: 'subscription' | 'assignment';
  onPick: (picked: PickedCategory) => void;
}) {
  const [squadId, setSquadId] = useState(SERVICE_SQUADS[0].id);
  const [query, setQuery] = useState('');
  const [sheetItem, setSheetItem] = useState<SquadItem | null>(null);

  const squad = SERVICE_SQUADS.find((s) => s.id === squadId) ?? SERVICE_SQUADS[0];
  const searching = query.trim().length > 0;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SERVICE_SQUADS.map((s) => ({
      squad: s,
      items: s.items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  // Keep the active squad chip in view when it changes (e.g. jumped to from a
  // search result).
  const railRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const chip = railRef.current?.querySelector<HTMLElement>(`[data-squad="${squadId}"]`);
    chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [squadId]);

  const select = (item: SquadItem, fromSquad: Squad) => {
    if (item.status === 'live' && item.brief) {
      onPick({
        brief: item.brief,
        briefRole: item.briefRole,
        itemId: item.id,
        squadId: fromSquad.id,
      });
      return;
    }
    setSheetItem(item);
  };

  const live = squad.items.filter((i) => i.status === 'live');
  const upcoming = squad.items.filter((i) => i.status !== 'live');

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[#FAFAFA]">
      {/* ── Sticky header: intro, search, squad rail ─────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-[#E7E7EA] bg-white">
        <div className="px-5 pt-5">
          <h2 className="font-[family-name:var(--font-jakarta)] text-[19px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
            What do you need?
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#737373]">
            Pick a squad, then the exact talent category for your {product}. You can add
            more categories later.
          </p>

          <div className="relative mt-3.5">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              inputMode="search"
              placeholder="Search all categories — designer, accountant, SEO…"
              aria-label="Search categories"
              className="w-full rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] py-2.5 pl-9 pr-9 text-sm text-[#0a0a0a] outline-none transition-colors placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:bg-white"
            />
            {searching && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#a3a3a3] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Squad rail — horizontally scrollable, Material-style chips. */}
        <div
          ref={railRef}
          role="tablist"
          aria-label="Squads"
          className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto px-5 pb-3"
        >
          {SERVICE_SQUADS.map((s) => {
            const active = !searching && s.id === squad.id;
            const liveCount = liveItemCount(s);
            return (
              <button
                key={s.id}
                data-squad={s.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => {
                  setQuery('');
                  setSquadId(s.id);
                  listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`flex flex-shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all active:scale-[0.97] ${
                  active
                    ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[0_1px_3px_rgba(0,0,0,0.18)]'
                    : 'border-[#E7E7EA] bg-white text-[#525252] hover:border-[#c9c9cf] hover:text-[#0a0a0a]'
                }`}
              >
                <span aria-hidden className="text-[15px] leading-none">{s.emoji}</span>
                <span className="whitespace-nowrap">{s.shortName}</span>
                {liveCount > 0 && (
                  <span
                    aria-label={`${liveCount} available now`}
                    className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#D7F250]' : 'bg-[#7BAF1E]'}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrolling panel ──────────────────────────────────────────────── */}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-4">
        {searching ? (
          results.length === 0 ? (
            <div className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-10 text-center">
              <p className="text-sm font-medium text-[#0a0a0a]">No categories match “{query.trim()}”</p>
              <p className="mt-1 text-[13px] text-[#737373]">
                Try a broader word — “video”, “tax”, “ads”.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {results.map((group) => (
                <section key={group.squad.id}>
                  <SectionHeading>
                    <span aria-hidden className="mr-1.5">{group.squad.emoji}</span>
                    {group.squad.name}
                  </SectionHeading>
                  {group.items.some((i) => i.status === 'live') && (
                    <ItemList
                      items={group.items.filter((i) => i.status === 'live')}
                      onSelect={(item) => select(item, group.squad)}
                    />
                  )}
                  {group.items.some((i) => i.status !== 'live') && (
                    <div className={group.items.some((i) => i.status === 'live') ? 'mt-2' : ''}>
                      <UpcomingGrid
                        items={group.items.filter((i) => i.status !== 'live')}
                        onSelect={(item) => select(item, group.squad)}
                      />
                    </div>
                  )}
                </section>
              ))}
            </div>
          )
        ) : (
          <>
            {/* Squad context — deliberately NOT a card. The white card + emoji
                tile + title + description shape belongs to the tappable
                categories below, so the squad reads as a heading, not a choice. */}
            <div className="px-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h3 className="font-[family-name:var(--font-jakarta)] text-[18px] font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                  {squad.name}
                </h3>
                {squad.badge && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#a3a3a3]">
                    {squad.badge}
                  </span>
                )}
              </div>
              <p className="mt-1.5 max-w-[52ch] text-[13px] leading-relaxed text-[#737373]">
                {squad.description}
              </p>
              <p className="mt-2 text-[11.5px] font-medium text-[#a3a3a3]">
                {squad.tags.join(' · ')}
              </p>
            </div>

            {live.length > 0 && (
              <section className="mt-6">
                <SectionHeading trailing={`${live.length} open`}>Available now</SectionHeading>
                <ItemList items={live} onSelect={(item) => select(item, squad)} />
              </section>
            )}

            {upcoming.length > 0 && (
              <section className="mt-6">
                <SectionHeading>{live.length > 0 ? 'More in this squad' : 'In this squad'}</SectionHeading>
                <UpcomingGrid items={upcoming} onSelect={(item) => select(item, squad)} />
              </section>
            )}

            {live.length === 0 && (
              <p className="mt-4 px-1 text-[12px] leading-relaxed text-[#909090]">
                This squad isn’t taking briefs yet. Tap a category to see where it stands —
                or switch to a squad with a green dot to start today.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Coming-soon bottom sheet ─────────────────────────────────────── */}
      {sheetItem && (
        <ComingSoonSheet
          item={sheetItem}
          product={product}
          onClose={() => setSheetItem(null)}
          onBrowseLive={() => {
            setSheetItem(null);
            setQuery('');
            const target = SERVICE_SQUADS.find((s) => liveItemCount(s) > 0);
            if (target) setSquadId(target.id);
            listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

/* ─── Subcomponents ───────────────────────────────────────────────────────── */

function SectionHeading({
  children,
  trailing,
}: {
  children: React.ReactNode;
  trailing?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between px-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[#909090]">
        {children}
      </h4>
      {trailing && (
        <span className="text-[11px] font-medium text-[#7BAF1E]">{trailing}</span>
      )}
    </div>
  );
}

function ItemList({
  items,
  onSelect,
}: {
  items: SquadItem[];
  onSelect: (item: SquadItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {items.map((item, idx) => (
        <ItemRow
          key={item.id}
          item={item}
          divided={idx > 0}
          onSelect={() => onSelect(item)}
        />
      ))}
    </div>
  );
}

/** Full-width row — used for categories you can brief today. */
function ItemRow({
  item,
  divided,
  onSelect,
}: {
  item: SquadItem;
  divided: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#FAFAFA] active:bg-[#F2FCBC]/60 ${
        divided ? 'border-t border-[#F0F0F2]' : ''
      }`}
    >
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F2FCBC] text-[20px]">
        <span aria-hidden>{item.emoji}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block font-[family-name:var(--font-jakarta)] text-[15px] font-semibold leading-snug text-[#0a0a0a]">
          {item.name}
        </span>
        <span className="mt-0.5 text-[12.5px] leading-relaxed text-[#8a8a8a] line-clamp-2">
          {item.desc}
        </span>
      </span>

      <svg
        className="h-5 w-5 flex-shrink-0 text-[#b5b5bb]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

/** Compact tiles — categories that aren't open for briefs yet. Tapping one
 *  opens the sheet with the full description and where it stands. */
function UpcomingGrid({
  items,
  onSelect,
}: {
  items: SquadItem[];
  onSelect: (item: SquadItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className="flex h-full flex-col items-start gap-2 rounded-2xl border border-[#E7E7EA] bg-white p-3 text-left transition-all hover:border-[#c9c9cf] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F4F5] text-[17px] opacity-90 grayscale-[0.35]">
            <span aria-hidden>{item.emoji}</span>
          </span>
          <span className="block flex-1 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold leading-snug text-[#525252]">
            {item.name}
          </span>
          <StatusPill status={item.status} />
        </button>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: SquadItem['status'] }) {
  if (status === 'waitlist') {
    return (
      <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-[#FFF4D6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8A6A12]">
        Waitlist
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8a8a8a]">
      Coming soon
    </span>
  );
}

function ComingSoonSheet({
  item,
  product,
  onClose,
  onBrowseLive,
}: {
  item: SquadItem;
  product: 'subscription' | 'assignment';
  onClose: () => void;
  onBrowseLive: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 cu-fade-in"
      />
      <div className="relative w-full rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.18)] animate-sheet-up">
        <div className="mx-auto h-1 w-10 rounded-full bg-[#E0E0E4]" />

        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#F4F4F5] text-[22px]">
            <span aria-hidden>{item.emoji}</span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
                {item.name}
              </h3>
              <StatusPill status={item.status} />
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#737373]">{item.desc}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] px-4 py-3 text-[13px] leading-relaxed text-[#525252]">
          {item.status === 'waitlist'
            ? `We’re onboarding talent for this category now. It isn’t open for ${product} briefs yet — your account manager can add you to the waiting list.`
            : `This category isn’t open for ${product} briefs yet. We’ll announce it here the moment it goes live.`}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onBrowseLive}
            className="w-full rounded-xl bg-[#0a0a0a] px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] sm:w-auto sm:flex-1"
          >
            See what’s available now
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-[#E7E7EA] bg-white px-4 py-3 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#FAFAFA] sm:w-auto sm:flex-1"
          >
            Back to categories
          </button>
        </div>
      </div>
    </div>
  );
}
