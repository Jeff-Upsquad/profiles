'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';

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
  status_changed_at: string | null;
  created_at: string;
}

const statusColors: Record<string, 'blue' | 'yellow' | 'green' | 'red'> = {
  new: 'blue',
  contacted: 'yellow',
  converted: 'green',
  rejected: 'red',
};

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
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ['admin-lead', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/leads/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/leads/${id}/status`, {
        status: newStatus,
        admin_notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Status updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update status');
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
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusColors[lead.status] || 'gray'}>
              {lead.status}
            </Badge>
            <Badge variant={lead.form_type === 'creative' ? 'indigo' : 'gray'}>
              {lead.form_type}
            </Badge>
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

      {/* Status Management */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Update Status</h2>
        {lead.admin_notes && (
          <div className="mb-4 rounded-lg bg-gray-50 p-3">
            <span className="block text-xs font-medium text-gray-500">Current Notes</span>
            <p className="mt-1 text-sm text-gray-700">{lead.admin_notes}</p>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="mb-1 block text-xs font-medium text-gray-600">New Status</label>
            <select
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600">Notes (optional)</label>
            <input
              type="text"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Add a note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button
            disabled={!newStatus}
            loading={updateStatus.isPending}
            onClick={() => updateStatus.mutate()}
          >
            Update
          </Button>
        </div>
      </div>
    </div>
  );
}
