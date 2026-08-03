'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import DesignerBriefForm from './DesignerBriefForm';
import AccountantBriefForm from './AccountantBriefForm';

type Product = 'subscription' | 'assignment';
type CategoryId = 'designer_editor' | 'accountant';

// Extensible category list. Add an entry (+ a matching form branch below) to
// offer a new service vertical. Field-level drafts are auto-saved per category.
const CATEGORIES: {
  id: CategoryId;
  label: string;
  description: string;
  iconPath: string;
}[] = [
  {
    id: 'designer_editor',
    label: 'Designer / Editor',
    description: 'Graphic design, video editing, or a hybrid who does both.',
    iconPath:
      'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  },
  {
    id: 'accountant',
    label: 'Accountant',
    description: 'Bookkeeping, taxation, compliance and financial reporting.',
    iconPath:
      'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
];

export default function ConnectBriefDrawer({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [category, setCategory] = useState<CategoryId | null>(null);

  // Reset to the category picker each time the drawer is opened. Field data is
  // still restored from the auto-saved draft once a category is re-picked.
  useEffect(() => {
    if (open) setCategory(null);
  }, [open]);

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
              onClick={() => setCategory(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[#525252] transition-colors hover:bg-[#f4f4f5] hover:text-[#0a0a0a]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Categories
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

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!open ? null : !category ? (
            <div className="px-5 py-6">
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                What would you like to create?
              </h2>
              <p className="mt-1 text-sm text-[#737373]">
                Pick a category to start your {product} brief. You can add more categories over time.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className="group flex items-start gap-3 rounded-xl border border-[#E7E7EA] bg-white p-4 text-left transition-all hover:border-[#0a0a0a] hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2] text-[#0a0a0a]">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={cat.iconPath} />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                        {cat.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[#737373]">
                        {cat.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : category === 'designer_editor' ? (
            <DesignerBriefForm product={product} />
          ) : (
            <AccountantBriefForm product={product} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
