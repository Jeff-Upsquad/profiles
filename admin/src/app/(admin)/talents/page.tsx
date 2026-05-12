'use client';

import { useSearchParams } from 'next/navigation';
import TalentCategories, { type EmploymentScope } from '@/views/talents/TalentCategories';

const VALID_SCOPES = new Set<EmploymentScope>(['partner_program', 'freelance', 'salary']);

export default function TalentsPage() {
  const searchParams = useSearchParams();
  const raw = searchParams?.get('type') ?? undefined;
  const scope = raw && VALID_SCOPES.has(raw as EmploymentScope) ? (raw as EmploymentScope) : undefined;
  return <TalentCategories employmentType={scope} />;
}
