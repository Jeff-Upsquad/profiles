'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import TalentProfileList, { type EmploymentScope } from '@/views/talents/TalentProfileList';

const VALID_SCOPES = new Set<EmploymentScope>(['partner_program', 'freelance', 'salary']);
const VALID_TRACKS = new Set(['both', 'subscriptions_only', 'assignments_only']);

export default function StateDashboardPage(props: {
  params: Promise<{ categoryId: string; stateName: string }>;
}) {
  const params = use(props.params);
  const searchParams = useSearchParams();
  const raw = searchParams?.get('type') ?? undefined;
  const scope = raw && VALID_SCOPES.has(raw as EmploymentScope) ? (raw as EmploymentScope) : undefined;
  const rawTrack = searchParams?.get('track') ?? undefined;
  const track = rawTrack && VALID_TRACKS.has(rawTrack) ? rawTrack as 'both' | 'subscriptions_only' | 'assignments_only' : undefined;
  return <TalentProfileList categoryId={params.categoryId} stateName={params.stateName} employmentType={scope} employmentTrack={track} />;
}
