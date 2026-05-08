'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import StatusTabs from './StatusTabs';
import ProfileTypeTabs from './ProfileTypeTabs';
import TalentOnboardingSection from './TalentOnboardingSection';
import InterviewInvitationSection from '@/views/interview/InterviewInvitationSection';
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
  terms_accepted: 'Terms Accepted',
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

export default function LeadSidePanelContent({ leadId }: { leadId: string }) {
  const { data: lead, isLoading } = useQuery<LeadFull>({
    queryKey: ['admin-lead', leadId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${leadId}`);
      return data;
    },
    enabled: !!leadId,
  });

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
  const whatsappHref = `https://wa.me/${linkPhone}?text=${encodeURIComponent(
    `Hi ${lead.name},\nThis is from Upsquad. We have received your application for Upsquad Partner Program.`
  )}`;

  const formDataEntries = Object.entries(lead.form_data || {}).filter(
    ([key]) => key !== 'terms_accepted'
  );

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
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-green-600 hover:text-green-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
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
    </div>
  );
}
