'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import StatusTabs from './StatusTabs';
import ProfileTypeTabs from './ProfileTypeTabs';
import NotesSection from './NotesSection';
import TalentOnboardingSection from './TalentOnboardingSection';
import OnboardingProgress from './OnboardingProgress';
import InterviewInvitationSection from '@/views/interview/InterviewInvitationSection';
import Link from 'next/link';
import { formatIndianPhone, cleanPhoneForLink } from '@/lib/phone';

interface LeadFull {
  id: string;
  form_type: string;
  status: string;
  name: string;
  email: string | null;
  phone: string;
  form_data: Record<string, any>;
  resume_url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  admin_notes: string | null;
  archive_reason: string | null;
  profile_type: string | null;
  profile_type_custom: string | null;
  linked_talent: { id: string; full_name: string; onboarding_completed: boolean; skip_onboarding?: boolean } | null;
  onboarding_progress: {
    signed_up: boolean;
    onboarding_completed: boolean;
    onboarding_bypassed?: boolean;
    basic_profile_completed: boolean;
    job_profile_completed: boolean;
    portfolio_completed: boolean;
  };
  auto_approved: boolean;
  deleted_at: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  role: 'Role',
  portfolio_link: 'Portfolio Link',
  age: 'Age',
  gender: 'Gender',
  native_place: 'Native Place',
  district: 'District',
  location: 'Location',
  work_type: 'Type of Work',
  education: 'Educational Qualifications',
  experience_years: 'Years of Experience',
  accounting_software: 'Accounting Software',
  addon_skills: 'Add-on Skills',
  current_salary: 'Current Salary / month',
  expected_salary: 'Expected Salary / month',
  languages: 'Languages',
  experience_details: 'Details of Experience',
  resume_url: 'Resume URL',
};

function formatValue(key: string, value: any): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && key.includes('salary')) {
    return `₹${value.toLocaleString('en-IN')}`;
  }
  return String(value);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export default function LeadSidePanelContent({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: lead, isLoading } = useQuery<LeadFull>({
    queryKey: ['admin-lead', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${leadId}`);
      return data;
    },
    enabled: !!leadId,
  });

  const refreshLists = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/leads/${leadId}`);
    },
    onSuccess: () => {
      toast.success('Candidate moved to recycle bin');
      refreshLists();
      onClose?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete candidate');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/leads/${leadId}/restore`);
    },
    onSuccess: () => {
      toast.success('Candidate restored');
      refreshLists();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to restore candidate');
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/leads/${leadId}/permanent`);
    },
    onSuccess: () => {
      toast.success('Candidate permanently deleted');
      refreshLists();
      onClose?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to permanently delete');
    },
  });

  const handleDelete = () => {
    if (window.confirm('Move this candidate to the recycle bin? You can restore them later.')) {
      deleteMutation.mutate();
    }
  };
  const handleRestore = () => {
    restoreMutation.mutate();
  };
  const handlePermanentDelete = () => {
    if (
      window.confirm(
        'Permanently delete this candidate and all related data (notes, interview invitations)? This cannot be undone.'
      )
    ) {
      permanentDeleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  if (!lead) {
    return <div className="p-6 text-sm text-gray-500">Lead not found</div>;
  }

  const linkPhone = cleanPhoneForLink(lead.phone);
  const displayPhone = formatIndianPhone(lead.phone);

  const formDataEntries = Object.entries(lead.form_data || {});

  return (
    <div className="space-y-5">
      {/* Identity header */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
            {lead.name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{lead.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={lead.form_type === 'creative' ? 'indigo' : 'gray'}>
                {lead.form_type}
              </Badge>
              {lead.linked_talent ? (
                <Badge variant="green">Signed up</Badge>
              ) : (
                <Badge variant="gray">Not signed up</Badge>
              )}
              {lead.auto_approved && (
                <Badge variant="indigo">Auto-approved</Badge>
              )}
              {lead.deleted_at && (
                <Badge variant="red">Deleted</Badge>
              )}
              <span className="text-gray-500">
                Applied{' '}
                {new Date(lead.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a
                href={`tel:+${linkPhone}`}
                className="inline-flex items-center gap-1 text-gray-700 hover:text-indigo-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {displayPhone}
              </a>
              <a
                href={`https://shcrm.squadhub.in/app/leads/lookup?phone=${linkPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
                CRM
              </a>
              {lead.linked_talent && (
                <Link
                  href={`/users/${lead.linked_talent.id}`}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  User
                </Link>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="inline-flex items-center gap-1 text-gray-700 hover:text-indigo-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {lead.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <Section title="Status">
        <StatusTabs leadId={lead.id} leadName={lead.name} currentStatus={lead.status} formType={lead.form_type} />
        {lead.status === 'archived' && lead.archive_reason && (
          <p className="mt-3 text-xs text-gray-500">
            Archived — <span className="font-medium">{lead.archive_reason.replace(/_/g, ' ')}</span>
          </p>
        )}
        {lead.admin_notes && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium uppercase text-gray-500">Admin Note</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-800">{lead.admin_notes}</p>
          </div>
        )}
      </Section>

      {/* Onboarding Progress */}
      <Section title="Onboarding Progress">
        <OnboardingProgress progress={lead.onboarding_progress} />
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <NotesSection leadId={lead.id} />
      </Section>

      {/* Profile type */}
      <Section title="Profile Type">
        <ProfileTypeTabs
          leadId={lead.id}
          currentType={lead.profile_type}
          currentCustom={lead.profile_type_custom}
        />
      </Section>

      {/* Talent onboarding (shortlisted only) */}
      {lead.status === 'shortlisted' && (
        <TalentOnboardingSection
          leadEmail={lead.email}
          leadName={lead.name}
          leadPhone={lead.phone}
          leadProfileType={lead.profile_type}
          leadProfileTypeCustom={lead.profile_type_custom}
          linkedTalent={lead.linked_talent}
        />
      )}

      {/* Form details */}
      {formDataEntries.length > 0 && (
        <Section title="Application Details">
          <dl className="grid gap-4 sm:grid-cols-2">
            {formDataEntries.map(([key, value]) => {
              const isWide = key === 'education' || key === 'experience_details';
              return (
                <div key={key} className={isWide ? 'sm:col-span-2' : ''}>
                  <KV label={FIELD_LABELS[key] || key.replace(/_/g, ' ')}>
                    {key === 'portfolio_link' || key === 'resume_url' ? (
                      <a
                        href={String(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-indigo-600 underline hover:text-indigo-800"
                      >
                        {String(value)}
                      </a>
                    ) : (
                      formatValue(key, value)
                    )}
                  </KV>
                </div>
              );
            })}
          </dl>
          {lead.resume_url && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <a
                href={lead.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Resume
              </a>
            </div>
          )}
        </Section>
      )}

      {/* Interview — reuse existing component */}
      <InterviewInvitationSection
        leadId={lead.id}
        leadName={lead.name}
        leadPhone={lead.phone}
        formType={lead.form_type}
      />

      {/* UTM */}
      {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
        <Section title="Campaign Tracking">
          <div className="grid gap-3 sm:grid-cols-3">
            {lead.utm_source && <KV label="Source">{lead.utm_source}</KV>}
            {lead.utm_medium && <KV label="Medium">{lead.utm_medium}</KV>}
            {lead.utm_campaign && <KV label="Campaign">{lead.utm_campaign}</KV>}
          </div>
        </Section>
      )}

      {/* Danger zone */}
      <Section title="Danger Zone">
        {lead.deleted_at ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This candidate is in the recycle bin (deleted{' '}
              {new Date(lead.deleted_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              ).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleRestore}
                disabled={restoreMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6-6m-6 6l6 6"
                  />
                </svg>
                Restore
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={permanentDeleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Forever
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Move this candidate to the recycle bin. They can be restored later
              from the Deleted tab.
            </p>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete Candidate
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
