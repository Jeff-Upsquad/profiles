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

  const handleClick = (value: Status) => {
    if (value === currentStatus) return;
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
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => handleClick(s.value)}
              disabled={active || updateStatus.isPending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? `${s.color} shadow-sm ring-2 ring-offset-1 ${
                      s.value === 'archived'
                        ? 'ring-red-300'
                        : s.value === 'onboard_completed'
                          ? 'ring-green-300'
                          : 'ring-indigo-300'
                    }`
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={active ? 'Current status' : `Switch to ${s.label}`}
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
