import SquadMemberPublicView from '@/views/agency/SquadMemberPublicView';

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category_id?: string; from?: string; agencyId?: string; preview_category_id?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const previewParams = new URLSearchParams({ tab: 'Individuals' });
  if (query.preview_category_id) previewParams.set('category_id', query.preview_category_id);
  if (query.agencyId) previewParams.set('agencyId', query.agencyId);

  return <SquadMemberPublicView
    memberId={id}
    categoryId={query.category_id}
    backHref={query.from === 'preview' ? `/agency/preview?${previewParams}` : undefined}
  />;
}
