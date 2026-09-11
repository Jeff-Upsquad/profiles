'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DesignerBriefForm from './DesignerBriefForm';
import AccountantBriefForm from './AccountantBriefForm';
import AdsSpecialistBriefForm from './AdsSpecialistBriefForm';
import SquadCategoryPicker, { type PickedCategory } from './SquadCategoryPicker';
import { SERVICE_SQUADS } from '@/data/serviceSquads';
import type { ConnectBriefCategoryId } from './categories';

type Product = 'subscription' | 'assignment';
export type { ConnectBriefCategoryId };

export default function ConnectBriefDrawer({
  open,
  onClose,
  product,
  initialCategory,
  preview = false,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
  initialCategory?: ConnectBriefCategoryId;
  preview?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [picked, setPicked] = useState<PickedCategory | null>(null);
  const category = picked?.brief ?? null;

  // Reset to the category browser each time the drawer is opened. Field data is
  // still restored from the auto-saved draft once a category is re-picked.
  useEffect(() => {
    if (open) setPicked(initialCategory ? seedFromCategory(initialCategory) : null);
  }, [initialCategory, open]);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const createLabel = product === 'assignment' ? 'Create an assignment' : 'Create a subscription';
  const pickedItem = picked ? findItem(picked) : null;

  return createPortal(
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      {/* Scrim */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Sliding panel */}
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E7E7EA] px-4 py-3">
          {category ? (
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[#525252] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="truncate">
                Categories
                {pickedItem && (
                  <span className="text-[#a3a3a3]"> · {pickedItem.name}</span>
                )}
              </span>
            </button>
          ) : (
            <span className="px-1 text-sm font-semibold text-[#0a0a0a]">
              {createLabel}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#a3a3a3] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — the picker owns its own scrolling (sticky squad rail), so the
            outer scroll is only used by the brief forms. */}
        <div className={`min-h-0 flex-1 ${category ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {!open ? null : !category ? (
            <SquadCategoryPicker product={product} onPick={setPicked} />
          ) : category === 'designer_editor' ? (
            <DesignerBriefForm product={product} preview={preview} initialRole={picked?.briefRole} />
          ) : category === 'accountant' ? (
            <AccountantBriefForm product={product} preview={preview} skipRolePicker />
          ) : (
            <AdsSpecialistBriefForm product={product} preview={preview} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Deep-link support: open straight into a form without going via the picker. */
function seedFromCategory(brief: ConnectBriefCategoryId): PickedCategory {
  for (const squad of SERVICE_SQUADS) {
    const item = squad.items.find((i) => i.brief === brief);
    if (item) {
      return { brief, briefRole: item.briefRole, itemId: item.id, squadId: squad.id };
    }
  }
  return { brief, itemId: brief, squadId: '' };
}

function findItem(picked: PickedCategory) {
  return (
    SERVICE_SQUADS.find((s) => s.id === picked.squadId)?.items.find((i) => i.id === picked.itemId) ??
    null
  );
}
