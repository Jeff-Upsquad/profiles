'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import ServiceCategoriesPreview from '@/components/preview/ServiceCategoriesPreview';

export default function ServiceCategoriesModePreview({ params }: { params: Promise<{ product: string }> }) {
  const { product } = use(params);
  if (product !== 'subscription' && product !== 'assignment') notFound();
  return <ServiceCategoriesPreview product={product} />;
}
