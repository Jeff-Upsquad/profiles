'use client';

import { useState } from 'react';
import BusinessHireHub from '@/views/business/BusinessHireHub';
import ConnectBriefDrawer from '@/components/business/connect-brief/ConnectBriefDrawer';

export default function AdSpecialistBriefPreview({ product }: { product: 'subscription' | 'assignment' }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-[#F5F5F6]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <BusinessHireHub preview />
      </div>
      <ConnectBriefDrawer
        open={open}
        onClose={() => setOpen(false)}
        product={product}
        initialCategory="ads_specialist"
        preview
      />
    </div>
  );
}
