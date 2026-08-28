'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import AgencyPublicPreview from '@/views/agency/AgencyPublicPreview';

function PreviewInner(){
  const sp = useSearchParams();
  const categoryId = sp.get('category_id') || sp.get('categoryId') || undefined;
  const agencyId = sp.get('agencyId') || undefined;
  const { data: me } = useQuery({ queryKey:['agencyMe'], queryFn: agencyApi.me });
  const effectiveAgencyId = agencyId || (me as any)?.id;
  const { data, isLoading, error } = useQuery({
    queryKey:['agencyPreview', effectiveAgencyId, categoryId],
    queryFn: ()=> agencyApi.preview({ category_id: categoryId, agencyId: effectiveAgencyId }),
    enabled: !!effectiveAgencyId,
  });

  if(!effectiveAgencyId) return <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" /></div>;

  return <AgencyPublicPreview data={data} isLoading={isLoading} error={error as any} categoryId={categoryId} />;
}

export default function AgencyPreviewPage(){
  return (
    <Suspense fallback={<div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" /></div>}>
      <PreviewInner />
    </Suspense>
  );
}
