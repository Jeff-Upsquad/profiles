'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import BusinessHireHub from '@/views/business/BusinessHireHub';
import ConnectBriefDrawer, { type ConnectBriefCategoryId } from '@/components/business/connect-brief/ConnectBriefDrawer';

function ServiceCategoriesContent({ product }: { product: 'subscription' | 'assignment' }) {
  const [open, setOpen] = useState(true);
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') as ConnectBriefCategoryId | null;

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
      <ConnectBriefDrawer
        open={open}
        onClose={() => setOpen(false)}
        product={product}
        initialCategory={categoryParam || undefined}
        preview
      />
    </div>
  );
}

/** Opens the brief drawer straight on the squad category browser or a specific category if query param provided. */
export default function ServiceCategoriesPreview({ product }: { product: 'subscription' | 'assignment' }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F5F6]" />}>
      <ServiceCategoriesContent product={product} />
    </Suspense>
  );
}

