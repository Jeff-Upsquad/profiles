'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

// Legacy /admin/leads/<id> entrypoint. The Candidates UI is a category hub
// (creative / accountant) and a single lead opens via the side panel on the
// in-category list — so we fetch the lead's form_type and forward to the
// canonical /admin/leads?form_type=<X>&selected=<id> URL. External deep-links
// (CRM "SquadHire candidate" badge, anywhere else) and the admin's own
// UserDetail "View lead" Link both flow through here.
type LeadFetch = { form_type: 'creative' | 'accountant' | 'sales' };

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string | undefined;

  const { data, isError } = useQuery<LeadFetch>({
    // Match LeadSidePanelContent's queryKey so the panel hits cache on arrival.
    queryKey: ['admin-lead', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${id}`);
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (!id || !data?.form_type) return;
    router.replace(
      `/leads?form_type=${encodeURIComponent(data.form_type)}&selected=${encodeURIComponent(id)}`,
    );
  }, [id, data?.form_type, router]);

  if (isError) {
    return (
      <div className="p-8 text-sm text-zinc-600">
        Lead not found.
      </div>
    );
  }
  return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
}
