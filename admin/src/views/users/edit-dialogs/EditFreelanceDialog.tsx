import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditFreelanceDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  available: boolean | null | undefined;
}

// Mirrors the talent Basic Profile "Freelance Preference" step — a single
// "Available to take freelance work" toggle. The office-hours / daily-hours
// scheduling lives in the separate Partner Program Preference section.
export default function EditFreelanceDialog({
  open,
  onClose,
  userId,
  available,
}: EditFreelanceDialogProps) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChecked(!!available);
  }, [open, available]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const handleSave = async () => {
    try {
      await updateBasic.mutateAsync({ freelance_available: checked });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Freelance Preference" size="lg">
      <div className="space-y-4">
        <label className="group flex cursor-pointer items-start gap-3 rounded-xl border border-[#E7E7EA] px-4 py-3 text-sm transition-all duration-200 has-[:checked]:border-[#0a0a0a] has-[:checked]:bg-[#FFFAC2] hover:border-[#a3a3a3] has-[:checked]:hover:border-[#0a0a0a]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[#E7E7EA] text-[#0a0a0a] focus:ring-[#0a0a0a]/30"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-medium text-[#0a0a0a]">Available to take freelance work</span>
            <span className="text-[13px] leading-snug text-[#525252]">Let brands know you can pick up one-off freelance projects.</span>
          </div>
        </label>
        <div className="flex items-start gap-3 rounded-xl bg-[#FDF6E7] p-4">
          <svg className="h-5 w-5 flex-shrink-0 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-[#92400E]">Each project has its own conditions — dates, deadlines and a fixed payment are agreed per project.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateBasic.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} loading={updateBasic.isPending}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
