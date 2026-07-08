'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import AutoApprovalEditor from './AutoApprovalEditor';
import { formatDate } from '@/lib/formatDate';

interface PublicForm {
  id: string;
  form_type: string;
  title: string;
  description: string;
  url_path: string;
  enabled: boolean;
  auto_approval_rules?: { enabled: boolean };
  created_at: string;
  updated_at: string;
}

const FRONTEND_ORIGIN = 'https://squadhire.upsquadconnect.com';

export default function FormManager() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: forms, isLoading } = useQuery<PublicForm[]>({
    queryKey: ['admin-forms'],
    queryFn: async () => {
      const { data } = await api.get('/admin/forms');
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await api.patch(`/admin/forms/${id}/toggle`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-forms'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update form');
    },
  });

  const copyLink = (form: PublicForm) => {
    const url = `${FRONTEND_ORIGIN}${form.url_path}`;
    navigator.clipboard.writeText(url);
    setCopiedId(form.id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Public Forms</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the public-facing candidate application forms. Toggle forms on
            or off, and copy shareable links for your Meta ad campaigns.
          </p>
        </div>
        <Link
          href="/forms/interview-questions"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Interview Questions
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {forms?.map((form) => (
          <div
            key={form.id}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {form.title}
                </h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {form.description}
                </p>
              </div>
              <Badge variant={form.enabled ? 'green' : 'red'}>
                {form.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>

            {/* URL */}
            <div className="mt-4 rounded-md bg-gray-50 px-3 py-2">
              <span className="block text-xs font-medium text-gray-500">
                Public URL
              </span>
              <code className="text-sm text-gray-700">
                {FRONTEND_ORIGIN}{form.url_path}
              </code>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
              {/* Toggle */}
              <button
                onClick={() =>
                  toggleMutation.mutate({
                    id: form.id,
                    enabled: !form.enabled,
                  })
                }
                disabled={toggleMutation.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  form.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                    form.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">
                {form.enabled ? 'Enabled' : 'Disabled'}
              </span>

              {/* Copy Link */}
              <button
                onClick={() => copyLink(form)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                {copiedId === form.id ? (
                  <>
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Link
                  </>
                )}
              </button>
            </div>

            {/* Auto-Approval */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <button
                onClick={() =>
                  setExpandedId(expandedId === form.id ? null : form.id)
                }
                className="flex w-full items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${
                    expandedId === form.id ? 'rotate-90' : ''
                  }`}
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
                Auto-Approval Rules
                {form.auto_approval_rules?.enabled && (
                  <Badge variant="green">Active</Badge>
                )}
              </button>
              {expandedId === form.id && (
                <div className="mt-3">
                  <AutoApprovalEditor
                    formId={form.id}
                    formType={form.form_type}
                  />
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400">
              Created {formatDate(form.created_at)}
            </div>
          </div>
        ))}
      </div>

      {forms?.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No public forms configured yet.
        </div>
      )}
    </div>
  );
}
