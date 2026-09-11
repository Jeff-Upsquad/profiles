'use client';

import { useState } from 'react';
import BusinessHireHub from '@/views/business/BusinessHireHub';
import ConnectBriefDrawer from '@/components/business/connect-brief/ConnectBriefDrawer';

/** Opens the brief drawer straight on the squad category browser. */
export default function ServiceCategoriesPreview({ product }: { product: 'subscription' | 'assignment' }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-[#F5F5F6]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <BusinessHireHub preview />
      </div>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 rounded-full bg-[#0a0a0a] px-5 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Reopen categories
        </button>
      )}
      <ConnectBriefDrawer open={open} onClose={() => setOpen(false)} product={product} preview />
    </div>
  );
}
