'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import LeadsTabs from './LeadsTabs';
import LeadSidePanel from './LeadSidePanel';
import { groupItemsByBucket } from '@/lib/groupLeadsByBucket';
import { formatIndianPhone } from '@/lib/phone';

type StageKey =
  | 'signed_up'
  | 'onboarding_completed'
  | 'basic_profile_completed'
  | 'job_profile_completed'
  | 'portfolio_completed';

interface OnboardingProgress {
  signed_up: boolean;
  onboarding_completed: boolean;
  basic_profile_completed: boolean;
  job_profile_completed: boolean;
  portfolio_completed: boolean;
}

interface OnboardingLead {
  id: string;
  form_type: string;
  status: string;
  name: string;
  email: string | null;
  phone: string;
  auto_approved: boolean;
  created_at: string;
  linked_talent: { id: string; full_name: string } | null;
  onboarding_progress: OnboardingProgress;
}

interface OnboardingResponse {
  leads: OnboardingLead[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const STAGES: { key: StageKey; label: string; short: string }[] = [
  { key: 'signed_up', label: 'Sign-up', short: 'Sign-up' },
  { key: 'onboarding_completed', label: 'Onboarding Course', short: 'Course' },
  { key: 'basic_profile_completed', label: 'Basic Profile', short: 'Basic' },
  { key: 'job_profile_completed', label: 'Job Profile', short: 'Job' },
  { key: 'portfolio_completed', label: 'Portfolio', short: 'Portfolio' },
];

const FORM_TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
];

function StageRow({ progress }: { progress: OnboardingProgress }) {
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, i) => {
        const done = progress[stage.key];
        const isLast = i === STAGES.length - 1;
        return (
          <div key={stage.key} className="flex items-center gap-1.5" title={`${stage.label}: ${done ? 'Done' : 'Pending'}`}>
            <div className="flex flex-col items-center gap-1">
              <span className="relative z-10 flex h-5 w-5 items-center justify-center">
                {done ? (
                  <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </span>
              <span
                className={`text-[10px] font-medium leading-none ${
                  done ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {stage.short}
              </span>
            </div>
            {!isLast && (
              <span
                className={`h-0.5 w-4 -translate-y-2 ${
                  done ? 'bg-green-300' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const formType = searchParams.get('form_type') || '';
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
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const { data, isLoading, isPlaceholderData } = useQuery<OnboardingResponse>({
    queryKey: ['admin-onboarding-leads', formType, search, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (formType) params.set('form_type', formType);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('limit', '25');
      const { data } = await api.get(`/admin/leads/onboarding?${params.toString()}`);
      return data;
    },
    placeholderData: keepPreviousData,
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
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">
          Signed-up candidates and their progress through onboarding. Click a row to open the candidate.
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

      {/* Search */}
      <div className="flex flex-wrap items-end gap-3">
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
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : !leads.length ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500">
            No signed-up candidates match your filters.
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
                              {lead.auto_approved && (
                                <Badge variant="indigo">Auto-approved</Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-gray-500">
                              {formatIndianPhone(lead.phone)}
                              {lead.email ? ` · ${lead.email}` : ''}
                            </p>
                          </div>
                          <div className="hidden lg:block">
                            <StageRow progress={lead.onboarding_progress} />
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
