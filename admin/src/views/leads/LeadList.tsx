'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import LeadsTabs from './LeadsTabs';
import LeadSidePanel from './LeadSidePanel';
import LeadFilterPanel, { type FormDataFilterRule } from './LeadFilterPanel';
import { groupItemsByBucket } from '@/lib/groupLeadsByBucket';
import { formatIndianPhone } from '@/lib/phone';

interface Lead {
  id: string;
  form_type: string;
  status: string;
  name: string;
  email: string | null;
  phone: string;
  form_data: Record<string, any>;
  auto_approved: boolean;
  created_at: string;
  linked_talent: { id: string; full_name: string } | null;
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
  share_form: 'blue',
  form_filled: 'yellow',
  under_review: 'yellow',
  shortlisted: 'indigo',
  signed_up: 'indigo',
  partner_onboarding: 'yellow',
  onboarding_training: 'yellow',
  basic_profile: 'yellow',
  job_profile: 'blue',
  portfolio_updation: 'blue',
  final_review: 'indigo',
  onboard_completed: 'green',
  live: 'green',
  no_response: 'gray',
  archived: 'gray',
  contacted: 'yellow',
  converted: 'green',
  rejected: 'red',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  share_form: 'Share Form',
  form_filled: 'Form Filled',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  signed_up: 'Signed Up',
  partner_onboarding: 'Onboarding',
  onboarding_training: 'Onboarding Training',
  basic_profile: 'Basic Profile',
  job_profile: 'Job Profile',
  portfolio_updation: 'Portfolio Updation',
  final_review: 'Final Review',
  onboard_completed: 'Completed',
  live: 'Live',
  no_response: 'No Response',
  archived: 'Archived',
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
};

const CATEGORY_LABELS: Record<string, string> = {
  creative: 'Creative',
  accountant: 'Accountant',
};

const CATEGORY_CARDS: { value: string; label: string; description: string; iconBg: string; iconColor: string; icon: React.ReactNode }[] = [
  {
    value: 'creative',
    label: 'Creative',
    description: 'Designers, video editors, and other creative roles.',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    value: 'accountant',
    label: 'Accountant',
    description: 'Bookkeeping, audit, tax, and finance professionals.',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h4M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const ROLE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Editor', label: 'Editor' },
  { value: 'Designer', label: 'Designer' },
  { value: 'Editor + Designer', label: 'Editor + Designer' },
];

const SIGNED_UP_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Candidates' },
  { value: 'true', label: 'Signed Up' },
];

const VIEW_TABS: { value: string; label: string }[] = [
  { value: '', label: 'Active' },
  { value: 'true', label: 'Recycle Bin' },
];

export default function LeadList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const formType = searchParams.get('form_type') || '';
  const status = searchParams.get('status') || '';
  const profileType = searchParams.get('profile_type') || '';
  const search = searchParams.get('search') || '';
  const role = searchParams.get('role') || '';
  const signedUp = searchParams.get('signed_up') || '';
  const deleted = searchParams.get('deleted') || '';
  const page = Number(searchParams.get('page') || '1');
  const selectedId = searchParams.get('selected');
  const formDataFilterParam = searchParams.get('form_data_filter') || '';

  const formDataRules = useMemo<FormDataFilterRule[]>(() => {
    if (!formDataFilterParam) return [];
    try {
      const arr = JSON.parse(formDataFilterParam);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [formDataFilterParam]);

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const isHubMode = !formType;

  const { data, isLoading, isPlaceholderData } = useQuery<LeadsResponse>({
    queryKey: ['admin-leads', formType, status, profileType, search, page, role, signedUp, deleted, formDataFilterParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (formType) params.set('form_type', formType);
      if (status) params.set('status', status);
      if (profileType) params.set('profile_type', profileType);
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      if (signedUp) params.set('signed_up', signedUp);
      if (deleted) params.set('deleted', deleted);
      if (formDataFilterParam) params.set('form_data_filter', formDataFilterParam);
      params.set('page', String(page));
      params.set('limit', '25');
      const { data } = await api.get(`/admin/leads?${params.toString()}`);
      return data;
    },
    placeholderData: keepPreviousData,
    enabled: !isHubMode,
  });

  // Lightweight per-category counts, only fetched on the hub.
  // Each call uses limit=1 so we just read the `total` field cheaply.
  const hubCounts = useQuery<Record<string, number>>({
    queryKey: ['admin-leads-counts'],
    queryFn: async () => {
      const results = await Promise.all(
        CATEGORY_CARDS.map(async (cat) => {
          const { data } = await api.get(`/admin/leads?form_type=${cat.value}&page=1&limit=1`);
          return [cat.value, data.total as number] as const;
        })
      );
      return Object.fromEntries(results);
    },
    enabled: isHubMode,
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

  if (isHubMode) {
    return (
      <div className="space-y-6">
        <LeadsTabs />

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a category to review applications.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_CARDS.map((cat) => (
            <button
              key={cat.value}
              onClick={() => updateQuery({ form_type: cat.value, page: '1', role: null })}
              className="text-left rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-indigo-300 hover:shadow-md"
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${cat.iconBg} ${cat.iconColor}`}>
                {cat.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{cat.label}</h3>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{cat.description}</p>
              <div className="mt-3 text-sm text-gray-500">
                {hubCounts.isLoading ? (
                  <span className="inline-block h-4 w-16 animate-pulse rounded bg-gray-100" />
                ) : (
                  <>
                    <span className="font-semibold text-gray-900">{hubCounts.data?.[cat.value] ?? 0}</span> candidates
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[formType] ?? formType;

  return (
    <div className="space-y-6">
      <LeadsTabs />

      <div>
        <button
          onClick={() => updateQuery({ form_type: null, page: '1', role: null, status: null, profile_type: null, search: null, signed_up: null, deleted: null, form_data_filter: null })}
          className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
        >
          &larr; Back to Categories
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{categoryLabel} Candidates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Applications grouped by time. Click a row to review and update status instantly.
        </p>
      </div>

      {/* Signed Up Toggle + View Toggle */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {SIGNED_UP_TABS.map((tab) => (
            <button
              key={tab.value || 'candidates'}
              onClick={() => updateQuery({ signed_up: tab.value, page: '1' })}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                signedUp === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.value || 'active'}
              onClick={() => updateQuery({ deleted: tab.value, page: '1' })}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                deleted === tab.value
                  ? tab.value
                    ? 'bg-white text-red-600 shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Role Sub-Filter (Creative only) */}
      {formType === 'creative' && (
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              onClick={() => updateQuery({ role: tab.value, page: '1' })}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                role === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Application-data filter + saved presets */}
      <LeadFilterPanel
        formType={formType}
        currentRules={formDataRules}
        onApply={(rules) => updateQuery({ form_data_filter: rules ? JSON.stringify(rules) : null, page: '1' })}
      />

      {/* Status, Tier & Search Filters */}
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
        <div className="w-44">
          <label className="mb-1 block text-xs font-medium text-gray-600">Tier</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={profileType}
            onChange={(e) => updateQuery({ profile_type: e.target.value, page: '1' })}
          >
            <option value="">All tiers</option>
            <option value="junior">Junior</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
            <option value="custom">Custom</option>
            <option value="none">Unassigned</option>
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
      <div className={`relative ${isPlaceholderData ? 'opacity-70 transition-opacity' : ''}`}>
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
                            {lead.linked_talent && (
                              <Badge variant="green">Signed up</Badge>
                            )}
                            {lead.auto_approved && (
                              <Badge variant="indigo">Auto-approved</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {formatIndianPhone(lead.phone)}
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
      </div>

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
