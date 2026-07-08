'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDate as formatLongDate } from '@/lib/formatDate';
import GrantAccessModal, { type GrantTarget } from './GrantAccessModal';

interface BusinessRequest {
  id: string;
  type: 'business';
  company_name: string | null;
  contact_person_name: string | null;
  contact_email: string | null;
  access_expires_at: string | null;
  access_requested_at: string;
}

interface CourseRequest {
  id: string;
  type: 'course';
  talent_user_id: string;
  talent_name: string | null;
  talent_email: string | null;
  course_id: string;
  course_title: string;
  countdown_hours: number | null;
  current_expires_at: string | null;
  reason: string | null;
  requested_at: string;
}

type Row = BusinessRequest | CourseRequest;

interface PendingRequestsResponse {
  business: BusinessRequest[];
  course: CourseRequest[];
}

function formatDate(iso: string | null): string {
  return iso ? formatLongDate(iso) : '—';
}

function formatRelative(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (absDays === 0) {
    const hours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    return diffMs >= 0
      ? `in ${hours}h`
      : `${hours}h ago`;
  }
  return diffMs >= 0 ? `in ${absDays}d` : `${absDays}d ago`;
}

export default function AccessRequestsList() {
  const queryClient = useQueryClient();
  const [grantTarget, setGrantTarget] = useState<GrantTarget | null>(null);

  const { data, isLoading } = useQuery<PendingRequestsResponse>({
    queryKey: ['admin-access-requests'],
    queryFn: async () => {
      const { data } = await api.get('/admin/access-requests');
      return data;
    },
  });

  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const merged: Row[] = [...data.business, ...data.course];
    merged.sort((a, b) => {
      const aT = a.type === 'business' ? a.access_requested_at : a.requested_at;
      const bT = b.type === 'business' ? b.access_requested_at : b.requested_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    });
    return merged;
  }, [data]);

  const rejectCourse = useMutation({
    mutationFn: async (requestId: string) => {
      await api.patch(`/admin/access-requests/course/${requestId}/reject`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-access-requests'] });
      toast.success('Request rejected');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject request');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Access Requests</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pending access renewals from business users and talents whose course
          deadlines have passed.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No pending access requests.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Current expiry</th>
                <th className="px-6 py-3">Requested</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => {
                if (row.type === 'business') {
                  const expiry = row.access_expires_at;
                  return (
                    <tr key={`b-${row.id}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Badge variant="blue">Business</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {row.contact_person_name || '—'}
                        </div>
                        <div className="text-xs text-gray-500">{row.contact_email || '—'}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{row.company_name || '—'}</td>
                      <td className="px-6 py-4">
                        <div className={expiry && new Date(expiry) < new Date() ? 'text-red-700' : 'text-gray-700'}>
                          {formatDate(expiry)}
                        </div>
                        {expiry && (
                          <div className="text-xs text-gray-500">{formatRelative(expiry)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {formatRelative(row.access_requested_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            setGrantTarget({
                              kind: 'business',
                              id: row.id,
                              name: row.contact_person_name || row.company_name || row.contact_email || 'Business user',
                              email: row.contact_email,
                              subject: row.company_name || '—',
                              currentExpiresAt: row.access_expires_at,
                            })
                          }
                        >
                          Grant
                        </Button>
                      </td>
                    </tr>
                  );
                }

                const expiry = row.current_expires_at;
                return (
                  <tr key={`c-${row.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Badge variant="indigo">Course</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {row.talent_name || '—'}
                      </div>
                      <div className="text-xs text-gray-500">{row.talent_email || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <div>{row.course_title}</div>
                      {row.reason && (
                        <div className="mt-1 text-xs italic text-gray-500 line-clamp-2">
                          “{row.reason}”
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={expiry && new Date(expiry) < new Date() ? 'text-red-700' : 'text-gray-700'}>
                        {formatDate(expiry)}
                      </div>
                      {expiry && (
                        <div className="text-xs text-gray-500">{formatRelative(expiry)}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatRelative(row.requested_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectCourse.mutate(row.id)}
                          loading={rejectCourse.isPending && rejectCourse.variables === row.id}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            setGrantTarget({
                              kind: 'course',
                              id: row.id,
                              name: row.talent_name || row.talent_email || 'Talent',
                              email: row.talent_email,
                              subject: row.course_title,
                              currentExpiresAt: row.current_expires_at,
                              countdownHours: row.countdown_hours,
                            })
                          }
                        >
                          Grant
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <GrantAccessModal
        target={grantTarget}
        onClose={() => setGrantTarget(null)}
        onGranted={() => {
          setGrantTarget(null);
          queryClient.invalidateQueries({ queryKey: ['admin-access-requests'] });
        }}
      />
    </div>
  );
}
