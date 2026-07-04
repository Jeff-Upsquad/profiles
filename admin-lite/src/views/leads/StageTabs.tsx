'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import ArchiveLeadModal from './ArchiveLeadModal';
import { useStageLabels } from '@/hooks/useStageLabels';

type Stage =
  | 'new'
  | 'share_form'
  | 'form_filled'
  | 'under_review'
  | 'shortlisted'
  | 'signed_up'
  | 'partner_onboarding'
  | 'onboarding_training'
  | 'basic_profile'
  | 'job_profile'
  | 'portfolio_updation'
  | 'final_review'
  | 'onboard_completed'
  | 'live'
  | 'no_response'
  | 'archived';

interface StageDef {
  value: Stage;
  label: string;
  color: string;
}

const CREATIVE_STAGES: StageDef[] = [
  { value: 'new', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'share_form', label: 'Share Form', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'form_filled', label: 'Form Filled / For Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'signed_up', label: 'Signed Up', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'onboarding_training', label: 'Onboarding Training', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'basic_profile', label: 'Basic Profile', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'job_profile', label: 'Job Profile', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'portfolio_updation', label: 'Portfolio Updation', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'final_review', label: 'Final Review', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'live', label: 'Live', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'no_response', label: 'No Response / In Active', color: 'bg-gray-50 text-gray-700 border-gray-200' },
];

const DEFAULT_STAGES: StageDef[] = [
  { value: 'new', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'under_review', label: 'Under Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'partner_onboarding', label: 'Onboarding', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'onboard_completed', label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'archived', label: 'Archived', color: 'bg-red-50 text-red-700 border-red-200' },
];

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

  const stages = formType === 'creative' ? CREATIVE_STAGES : DEFAULT_STAGES;

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
