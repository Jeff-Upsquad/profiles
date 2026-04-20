'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import ArchiveLeadModal from './ArchiveLeadModal';

type Status =
  | 'new'
  | 'under_review'
  | 'shortlisted'
  | 'partner_onboarding'
  | 'onboard_completed'
  | 'archived';

const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'under_review', label: 'Under Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'partner_onboarding', label: 'Onboarding', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'onboard_completed', label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'archived', label: 'Archived', color: 'bg-red-50 text-red-700 border-red-200' },
];

// Allowed forward transitions from each status (aligned with backend validation).
const NEXT_STATUSES: Record<string, Status[]> = {
  new: ['new', 'under_review', 'shortlisted', 'archived'],
  under_review: ['under_review', 'shortlisted', 'archived'],
  shortlisted: ['shortlisted', 'partner_onboarding', 'archived'],
  partner_onboarding: ['partner_onboarding', 'onboard_completed', 'archived'],
  onboard_completed: ['onboard_completed', 'archived'],
  archived: ['archived', 'new'],
  contacted: ['under_review', 'shortlisted', 'archived'],
  converted: ['onboard_completed', 'archived'],
  rejected: ['new', 'archived'],
};

interface Props {
  leadId: string;
  leadName: string;
  currentStatus: string;
}

export default function StatusTabs({ leadId, leadName, currentStatus }: Props) {
  const queryClient = useQueryClient();
  const [archiveOpen, setArchiveOpen] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async (payload: {
      status: Status;
      admin_notes?: string;
      archive_reason?: string;
    }) => {
      await api.patch(`/admin/leads/${leadId}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Status updated');
      setArchiveOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed');
    },
  });

  const allowed = new Set(NEXT_STATUSES[currentStatus] ?? [currentStatus]);

  const handleClick = (value: Status) => {
    if (value === currentStatus) return;
    if (!allowed.has(value)) return;
    if (value === 'archived') {
      setArchiveOpen(true);
      return;
    }
    updateStatus.mutate({ status: value });
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => {
          const active = s.value === currentStatus;
          const isAllowed = allowed.has(s.value);
          const disabled = !active && !isAllowed;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => handleClick(s.value)}
              disabled={disabled || updateStatus.isPending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? `${s.color} shadow-sm ring-2 ring-offset-1 ${
                      s.value === 'archived'
                        ? 'ring-red-300'
                        : s.value === 'onboard_completed'
                          ? 'ring-green-300'
                          : 'ring-indigo-300'
                    }`
                  : disabled
                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={
                disabled
                  ? `Not an allowed transition from ${currentStatus}`
                  : active
                    ? 'Current status'
                    : `Switch to ${s.label}`
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <ArchiveLeadModal
        isOpen={archiveOpen}
        leadName={leadName}
        pending={updateStatus.isPending}
        onClose={() => setArchiveOpen(false)}
        onSubmit={(reason, note) =>
          updateStatus.mutate({
            status: 'archived',
            archive_reason: reason,
            admin_notes: note,
          })
        }
      />
    </>
  );
}
