'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

// { formType -> { internalKey -> live CRM stage name } }. Sourced from the
// admin's CRM Status Mapping so a stage renamed in the CRM shows across the
// Leads boards without a code change. Falls back to caller-provided labels
// whenever a stage isn't mapped.
type StageLabels = Record<string, Record<string, string>>;

export function useStageLabels() {
  const { data } = useQuery({
    queryKey: ['crm-stage-labels'],
    queryFn: async () => {
      const res = await api.get('/admin/leads/stage-labels');
      return (res.data.labels ?? {}) as StageLabels;
    },
    staleTime: 60 * 1000,
  });

  const labels = data ?? {};

  const labelFor = (formType: string | undefined, key: string, fallback?: string): string =>
    (formType ? labels[formType]?.[key] : undefined) ?? fallback ?? key;

  return { labels, labelFor };
}
