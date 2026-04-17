'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

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

const statusColors: Record<string, 'blue' | 'yellow' | 'green' | 'red'> = {
  new: 'blue',
  contacted: 'yellow',
  converted: 'green',
  rejected: 'red',
};

const FORM_TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
];

export default function LeadList() {
  const router = useRouter();
  const [formType, setFormType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lead Submissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage submissions from Meta ad forms
        </p>
      </div>

      {/* Form Type Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {FORM_TYPE_TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            onClick={() => { setFormType(tab.value); setPage(1); }}
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
        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
          <select
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="w-64">
          <Input
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submitted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : !data?.leads.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No leads found
                </td>
              </tr>
            ) : (
              data.leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/leads/${lead.id}`)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {lead.form_data?.role || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusColors[lead.status] || 'gray'}>
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(lead.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
