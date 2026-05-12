'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import TalentProfileList, { type EmploymentScope } from '@/views/talents/TalentProfileList';

const VALID_SCOPES = new Set<EmploymentScope>(['partner_program', 'freelance', 'salary']);

export default function TalentCategoryPage(props: { params: Promise<{ categoryId: string }> }) {
  const params = use(props.params);
  const searchParams = useSearchParams();
  const raw = searchParams?.get('type') ?? undefined;
  const scope = raw && VALID_SCOPES.has(raw as EmploymentScope) ? (raw as EmploymentScope) : undefined;
  return <TalentProfileList categoryId={params.categoryId} employmentType={scope} />;
}
