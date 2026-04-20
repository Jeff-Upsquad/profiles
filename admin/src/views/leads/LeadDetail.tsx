'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import InterviewInvitationSection from '@/views/interview/InterviewInvitationSection';

interface Lead {
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
  status_changed_at: string | null;
  created_at: string;
}

type Status =
  | 'new'
  | 'under_review'
  | 'shortlisted'
  | 'partner_onboarding'
  | 'onboard_completed'
  | 'archived'
  | 'contacted'
  | 'converted'
  | 'rejected';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  partner_onboarding: 'Partner Onboarding',
  onboard_completed: 'Onboard Completed',
  archived: 'Archived',
  // legacy
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
};

const statusColors: Record<string, 'blue' | 'yellow' | 'green' | 'red' | 'indigo' | 'gray'> = {
  new: 'blue',
  under_review: 'yellow',
  shortlisted: 'indigo',
  partner_onboarding: 'yellow',
  onboard_completed: 'green',
  archived: 'gray',
  // legacy
  contacted: 'yellow',
  converted: 'green',
  rejected: 'red',
};

// Allowed forward transitions from each status
const NEXT_STATUSES: Record<string, Status[]> = {
  new: ['under_review', 'shortlisted', 'archived'],
  under_review: ['shortlisted', 'archived'],
  shortlisted: ['partner_onboarding', 'archived'],
  partner_onboarding: ['onboard_completed', 'archived'],
  onboard_completed: ['archived'],
  archived: ['new'], // allow un-archive back to new
  // legacy (treat like new)
  contacted: ['under_review', 'shortlisted', 'archived'],
  converted: ['onboard_completed', 'archived'],
  rejected: ['new', 'archived'],
};

const ARCHIVE_REASONS: { value: string; label: string }[] = [
  { value: 'not_qualified', label: 'Not qualified' },
  { value: 'not_responsive', label: 'Not responsive' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
];

const PROFILE_TYPES: { value: string; label: string }[] = [
  { value: 'junior', label: 'Junior' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
  { value: 'custom', label: 'Custom' },
];

// Human-readable field labels
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
  accounting_software: 'Accounting Softwares',
  addon_skills: 'Add-on Skills',
  current_salary: 'Current Salary/month',
  expected_salary: 'Expected Salary/month',
  languages: 'Languages',
  experience_details: 'Details of Experience',
  resume_url: 'Resume URL',
  terms_accepted: 'Terms Accepted',
};

export default function LeadDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['admin-lead', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${id}`);
      return data;
    },
    enabled: !!id,
  });

  // Status update state
  const [nextStatus, setNextStatus] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveNote, setArchiveNote] = useState('');

  // Profile type state
  const [profileType, setProfileType] = useState<string>('');
  const [profileTypeCustom, setProfileTypeCustom] = useState('');

  useEffect(() => {
    if (lead) {
      setProfileType(lead.profile_type ?? '');
      setProfileTypeCustom(lead.profile_type_custom ?? '');
    }
  }, [lead]);

  const updateStatus = useMutation({
    mutationFn: async (payload: {
      status: Status;
      admin_notes?: string;
      archive_reason?: string;
    }) => {
      await api.patch(`/admin/leads/${id}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Status updated');
      setNotes('');
      setNextStatus('');
      setShowArchiveModal(false);
      setArchiveReason('');
      setArchiveNote('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update status');
    },
  });

  const updateProfileType = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/leads/${id}/profile-type`, {
        profile_type: profileType || null,
        profile_type_custom: profileType === 'custom' ? profileTypeCustom : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Profile type updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update profile type');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="py-12 text-center text-gray-500">Lead not found</div>
    );
  }

  const formatValue = (key: string, value: any): string => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key.includes('salary')) return `₹${Number(value).toLocaleString('en-IN')}`;
    return String(value);
  };

  const nextStatuses = NEXT_STATUSES[lead.status] ?? ['archived'];

  const handleApplyStatus = () => {
    if (!nextStatus) return;
    if (nextStatus === 'archived') {
      setShowArchiveModal(true);
      return;
    }
    updateStatus.mutate({ status: nextStatus as Status, admin_notes: notes || undefined });
  };

  const handleArchiveSubmit = () => {
    if (!archiveReason) {
      toast.error('Please select a reason');
      return;
    }
    if (!archiveNote.trim()) {
      toast.error('Please add a note explaining why');
      return;
    }
    updateStatus.mutate({
      status: 'archived',
      archive_reason: archiveReason,
      admin_notes: archiveNote,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/leads')}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={statusColors[lead.status] || 'gray'}>
              {STATUS_LABELS[lead.status] || lead.status}
            </Badge>
            <Badge variant={lead.form_type === 'creative' ? 'indigo' : 'gray'}>
              {lead.form_type}
            </Badge>
            {lead.profile_type && (
              <Badge variant="indigo">
                {lead.profile_type === 'custom'
                  ? lead.profile_type_custom || 'Custom'
                  : PROFILE_TYPES.find((p) => p.value === lead.profile_type)?.label ?? lead.profile_type}
              </Badge>
            )}
            <span className="text-sm text-gray-500">
              Submitted {new Date(lead.created_at).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Contact Information</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="block text-xs font-medium uppercase text-gray-500">Name</span>
            <span className="text-sm text-gray-900">{lead.name}</span>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase text-gray-500">Phone</span>
            <span className="text-sm text-gray-900">{lead.phone}</span>
            <a
              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                `Hi, ${lead.name}\nThis is from Upsquad. We have received your application for Upsquad Partner Program.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Open in WhatsApp
            </a>
          </div>
          <div>
            <span className="block text-xs font-medium uppercase text-gray-500">Email</span>
            <span className="text-sm text-gray-900">{lead.email || '—'}</span>
          </div>
        </div>
      </div>

      {/* Form Data */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Form Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {Object.entries(lead.form_data).map(([key, value]) => {
            if (key === 'terms_accepted') return null;
            return (
              <div key={key} className={key === 'education' || key === 'experience_details' ? 'sm:col-span-2' : ''}>
                <dt className="text-xs font-medium uppercase text-gray-500">
                  {FIELD_LABELS[key] || key.replace(/_/g, ' ')}
                </dt>
                <dd className="mt-0.5 text-sm text-gray-900">
                  {key === 'portfolio_link' || key === 'resume_url' ? (
                    <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline hover:text-indigo-800">
                      {String(value)}
                    </a>
                  ) : (
                    formatValue(key, value)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
        {lead.resume_url && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <dt className="text-xs font-medium uppercase text-gray-500">Resume</dt>
            <dd className="mt-0.5">
              <a href={lead.resume_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 underline hover:text-indigo-800">
                Download Resume
              </a>
            </dd>
          </div>
        )}
      </div>

      {/* UTM Tracking */}
      {(lead.utm_source || lead.utm_medium || lead.utm_campaign) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Campaign Tracking</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {lead.utm_source && (
              <div>
                <span className="block text-xs font-medium uppercase text-gray-500">Source</span>
                <span className="text-sm text-gray-900">{lead.utm_source}</span>
              </div>
            )}
            {lead.utm_medium && (
              <div>
                <span className="block text-xs font-medium uppercase text-gray-500">Medium</span>
                <span className="text-sm text-gray-900">{lead.utm_medium}</span>
              </div>
            )}
            {lead.utm_campaign && (
              <div>
                <span className="block text-xs font-medium uppercase text-gray-500">Campaign</span>
                <span className="text-sm text-gray-900">{lead.utm_campaign}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* First-Level Interview */}
      <InterviewInvitationSection
        leadId={lead.id}
        leadName={lead.name}
        leadPhone={lead.phone}
        formType={lead.form_type}
      />

      {/* Profile Type */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Profile Type</h2>
        <p className="mb-4 text-sm text-gray-500">
          Classify this candidate for internal tracking.
        </p>
        <div className="flex flex-wrap gap-2">
          {PROFILE_TYPES.map((pt) => (
            <button
              key={pt.value}
              type="button"
              onClick={() => setProfileType(pt.value)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                profileType === pt.value
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {pt.label}
            </button>
          ))}
          {profileType && (
            <button
              type="button"
              onClick={() => setProfileType('')}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
        {profileType === 'custom' && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Custom label
            </label>
            <input
              type="text"
              value={profileTypeCustom}
              onChange={(e) => setProfileTypeCustom(e.target.value)}
              placeholder="e.g. Specialist"
              maxLength={100}
              className="block w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        <div className="mt-4">
          <Button
            loading={updateProfileType.isPending}
            disabled={profileType === 'custom' && !profileTypeCustom.trim()}
            onClick={() => updateProfileType.mutate()}
          >
            Save profile type
          </Button>
        </div>
      </div>

      {/* Status Management */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Update Status</h2>
        <p className="mb-4 text-sm text-gray-500">
          Current:{' '}
          <span className="font-medium text-gray-900">
            {STATUS_LABELS[lead.status] || lead.status}
          </span>
          {lead.status === 'archived' && lead.archive_reason && (
            <span className="text-gray-500">
              {' '}— {ARCHIVE_REASONS.find((r) => r.value === lead.archive_reason)?.label ?? lead.archive_reason}
            </span>
          )}
        </p>
        {lead.admin_notes && (
          <div className="mb-4 rounded-lg bg-gray-50 p-3">
            <span className="block text-xs font-medium text-gray-500">Current Notes</span>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{lead.admin_notes}</p>
          </div>
        )}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Notes (optional)
          </label>
          <input
            type="text"
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Add a note that will be saved with the status change..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              New status
            </label>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select status...</option>
              {nextStatuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={!nextStatus}
            loading={updateStatus.isPending}
            variant={nextStatus === 'archived' ? 'danger' : 'primary'}
            onClick={handleApplyStatus}
          >
            {nextStatus === 'archived' ? 'Archive…' : 'Update'}
          </Button>
        </div>
      </div>

      {/* Archive Modal */}
      <Modal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setArchiveReason('');
          setArchiveNote('');
        }}
        title="Archive Lead"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Archiving <span className="font-medium text-gray-900">{lead.name}</span>.
            Please share a reason so the team knows why.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a reason...</option>
              {ARCHIVE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              rows={4}
              placeholder="Explain why this profile is being archived..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowArchiveModal(false);
                setArchiveReason('');
                setArchiveNote('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={updateStatus.isPending}
              onClick={handleArchiveSubmit}
            >
              Archive
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
