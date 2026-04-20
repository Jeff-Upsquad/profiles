'use client';

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import LeadsTabs from './LeadsTabs';
import LeadSidePanel from './LeadSidePanel';
import { groupItemsByBucket } from '@/lib/groupLeadsByBucket';

interface Lead {
  id: string;
  form_type: string;
  status: string;
  name: string;
  email: string | null;
  phone: string;
  form_data: Record<string, any>;
  created_at: string;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const statusColors: Record<string, 'blue' | 'yellow' | 'green' | 'red' | 'indigo' | 'gray'> = {
  new: 'blue',
  under_review: 'yellow',
  shortlisted: 'indigo',
  partner_onboarding: 'yellow',
  onboard_completed: 'green',
  archived: 'gray',
  contacted: 'yellow',
  converted: 'green',
  rejected: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  partner_onboarding: 'Onboarding',
  onboard_completed: 'Completed',
  archived: 'Archived',
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
};

const FORM_TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
];

export default function LeadList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const formType = searchParams.get('form_type') || '';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page') || '1');
  const selectedId = searchParams.get('selected');

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const { data, isLoading } = useQuery<LeadsResponse>({
    queryKey: ['admin-leads', formType, status, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (formType) params.set('form_type', formType);
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '25');
      const { data } = await api.get(`/admin/leads?${params.toString()}`);
      return data;
    },
  });

  const leads = data?.leads ?? [];
  const buckets = useMemo(() => groupItemsByBucket(leads), [leads]);

  const selectedIndex = useMemo(() => {
    if (!selectedId) return null;
    const idx = leads.findIndex((l) => l.id === selectedId);
    return idx === -1 ? null : idx;
  }, [selectedId, leads]);

  const openLead = (id: string) => updateQuery({ selected: id });
  const closeLead = () => updateQuery({ selected: null });
  const navigate = (direction: -1 | 1) => {
    if (selectedIndex === null) return;
    const next = leads[selectedIndex + direction];
    if (next) updateQuery({ selected: next.id });
  };

  return (
    <div className="space-y-6">
      <LeadsTabs />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Applications grouped by time. Click a row to review and update status instantly.
        </p>
      </div>

      {/* Form Type Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {FORM_TYPE_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            onClick={() => updateQuery({ form_type: tab.value, page: '1' })}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              formType === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Status & Search Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={status}
            onChange={(e) => updateQuery({ status: e.target.value, page: '1' })}
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="under_review">Under Review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="partner_onboarding">Onboarding</option>
            <option value="onboard_completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="w-72">
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => updateQuery({ search: e.target.value, page: '1' })}
          />
        </div>
      </div>

      {/* Grouped list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : !leads.length ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
          No candidates match your filters.
        </div>
      ) : (
        <div className="space-y-6">
          {buckets.map((bucket) => (
            <section key={bucket.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {bucket.label}
                </h2>
                <span className="text-xs text-gray-400">{bucket.items.length}</span>
                <div className="ml-2 h-px flex-1 bg-gray-200" />
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <ul className="divide-y divide-gray-100">
                  {bucket.items.map((lead) => {
                    const isSelected = lead.id === selectedId;
                    return (
                      <li
                        key={lead.id}
                        onClick={() => openLead(lead.id)}
                        className={`flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                          {lead.name
                            .split(' ')
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {lead.name}
                            </p>
                            <Badge variant={lead.form_type === 'creative' ? 'indigo' : 'gray'}>
                              {lead.form_type}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {lead.phone}
                            {lead.email ? ` · ${lead.email}` : ''}
                          </p>
                        </div>
                        <div className="hidden sm:block">
                          <Badge variant={statusColors[lead.status] || 'gray'}>
                            {STATUS_LABELS[lead.status] || lead.status}
                          </Badge>
                        </div>
                        <div className="hidden w-24 text-right text-xs text-gray-400 md:block">
                          {new Date(lead.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {data.page} of {data.total_pages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => updateQuery({ page: String(page - 1) })}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page >= data.total_pages}
              onClick={() => updateQuery({ page: String(page + 1) })}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Side panel */}
      <LeadSidePanel
        leadId={selectedId}
        onClose={closeLead}
        onNavigate={navigate}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < leads.length - 1}
        currentIndex={selectedIndex}
        totalCount={leads.length}
      />
    </div>
  );
}
