import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import CreativeLeadForm from '@/views/forms/CreativeLeadForm';
import { TALENT_CATEGORY_OPTIONS } from '../../../../../shared/src/contentRoles';

export default async function ContentApplicationPage({ params }: { params: Promise<{ formType: string }> }) {
  const { formType } = await params;
  const category = TALENT_CATEGORY_OPTIONS.find((c) => c.value === formType);
  if (!category || ['creative', 'accountant', 'sales'].includes(formType)) notFound();
  return <Suspense><CreativeLeadForm category={{ formType: category.value, label: category.label }} /></Suspense>;
}
