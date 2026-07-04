'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import ArchiveLeadModal from './ArchiveLeadModal';
import { useStageLabels } from '@/hooks/useStageLabels';
import { type Stage, stagesForFormType } from '@/constants/leadStages';

const RING_COLOR: Record<string, string> = {
  archived: 'ring-red-300',
  no_response: 'ring-gray-300',
  onboard_completed: 'ring-green-300',
  live: 'ring-emerald-300',
};

interface Props {
  leadId: string;
  leadName: string;
  currentStage: string;
  formType?: string;
}

export default function StageTabs({ leadId, leadName, currentStage, formType }: Props) {
  const queryClient = useQueryClient();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { labelFor } = useStageLabels();

  const stages = stagesForFormType(formType);

  const updateStage = useMutation({
    mutationFn: async (payload: {
      status: Stage;
      admin_notes?: string;
      archive_reason?: string;
    }) => {
      await api.patch(`/admin/leads/${leadId}/status`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Stage updated');
      setArchiveOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed');
    },
  });

  const handleClick = (value: Stage) => {
    if (value === currentStage) return;
    if (value === 'archived') {
      setArchiveOpen(true);
      return;
    }
    updateStage.mutate({ status: value });
  };

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {stages.map((s) => {
          const active = s.value === currentStage;
          const ringColor = RING_COLOR[s.value] ?? 'ring-indigo-300';
          const label = labelFor(formType, s.value, s.label);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => handleClick(s.value)}
              disabled={active || updateStage.isPending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? `${s.color} shadow-sm ring-2 ring-offset-1 ${ringColor}`
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title={active ? 'Current stage' : `Switch to ${label}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ArchiveLeadModal
        isOpen={archiveOpen}
        leadName={leadName}
        pending={updateStage.isPending}
        onClose={() => setArchiveOpen(false)}
        onSubmit={(reason, note) =>
          updateStage.mutate({
            status: 'archived',
            archive_reason: reason,
            admin_notes: note,
          })
        }
      />
    </>
  );
}
