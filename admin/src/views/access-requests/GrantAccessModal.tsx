'use client';

import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { formatDateTime } from '@/lib/formatDate';

export interface GrantTarget {
  kind: 'business' | 'course';
  id: string;
  name: string;
  email: string | null;
  subject: string;
  currentExpiresAt: string | null;
  countdownHours?: number | null;
}

interface Props {
  target: GrantTarget | null;
  onClose: () => void;
  onGranted: () => void;
}

function formatDateLong(iso: string | null): string {
  return iso ? formatDateTime(iso) : 'Never set';
}

function describeRelative(iso: string | null): string {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const days = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (diffMs >= 0) return days === 0 ? 'expires today' : `in ${days}d`;
  return days === 0 ? 'expired today' : `expired ${days}d ago`;
}

export default function GrantAccessModal({ target, onClose, onGranted }: Props) {
  const grant = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (target.kind === 'business') {
        await api.patch(`/admin/access-requests/business/${target.id}/grant`, {});
      } else {
        await api.patch(`/admin/access-requests/course/${target.id}/grant`, {});
      }
    },
    onSuccess: () => {
      toast.success(target?.kind === 'business' ? 'Access granted' : 'Course reopened');
      onGranted();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to grant access');
    },
  });

  if (!target) return null;

  const isExpired = target.currentExpiresAt
    ? new Date(target.currentExpiresAt) < new Date()
    : false;

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title={`Grant access to ${target.name}`}
      size="md"
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">Type</span>
            <span className="font-medium text-gray-900 capitalize">{target.kind}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">User</span>
            <span className="font-medium text-gray-900 text-right">
              {target.name}
              {target.email && (
                <span className="block text-xs text-gray-500">{target.email}</span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{target.kind === 'course' ? 'Course' : 'Company'}</span>
            <span className="font-medium text-gray-900 text-right">{target.subject}</span>
          </div>
          {target.kind === 'course' && (
            <div className="flex justify-between">
              <span className="text-gray-500">Current expiry</span>
              <span className={`font-medium text-right ${isExpired ? 'text-red-700' : 'text-gray-900'}`}>
                {formatDateLong(target.currentExpiresAt)}
                {target.currentExpiresAt && (
                  <span className="block text-xs text-gray-500">
                    {describeRelative(target.currentExpiresAt)}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {target.kind === 'business' ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
            This grants the business account permanent access. There is no expiry date.
          </div>
        ) : (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-900">
            Granting will reset the countdown. The talent gets a fresh{' '}
            <strong>{target.countdownHours ?? '—'} hours</strong> from when they next press <em>Start</em>.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => grant.mutate()}
            loading={grant.isPending}
          >
            Confirm Grant
          </Button>
        </div>
      </div>
    </Modal>
  );
}
