'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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
  if (!iso) return 'Never set';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function describeRelative(iso: string | null): string {
  if (!iso) return '';
  const diffMs = new Date(iso).getTime() - Date.now();
  const days = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (diffMs >= 0) return days === 0 ? 'expires today' : `in ${days}d`;
  return days === 0 ? 'expired today' : `expired ${days}d ago`;
}

function defaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10); // yyyy-mm-dd for <input type="date">
}

export default function GrantAccessModal({ target, onClose, onGranted }: Props) {
  const [newExpiryDate, setNewExpiryDate] = useState(defaultExpiryDate());

  // Reset date input when target changes (modal opens for a different row)
  useEffect(() => {
    if (target) setNewExpiryDate(defaultExpiryDate());
  }, [target?.id]);

  const grant = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (target.kind === 'business') {
        // Build an ISO datetime at end of day on the chosen date
        const dt = new Date(newExpiryDate + 'T23:59:59');
        await api.patch(
          `/admin/access-requests/business/${target.id}/grant`,
          { expiresAt: dt.toISOString() },
        );
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
        </div>

        {target.kind === 'business' ? (
          <Input
            label="New expiry date"
            type="date"
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            max={new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)}
            value={newExpiryDate}
            onChange={(e) => setNewExpiryDate(e.target.value)}
            helperText="Defaults to 30 days from today; you can pick any date up to a year out."
          />
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
            disabled={target.kind === 'business' && !newExpiryDate}
          >
            Confirm Grant
          </Button>
        </div>
      </div>
    </Modal>
  );
}
