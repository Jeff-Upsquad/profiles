import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import PartnerProgramPreference from '@/components/forms/PartnerProgramPreference';
import type { DayHours, DayAvailableHours } from '@/lib/workHours';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditPartnerProgramDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  officeHours: { day: string; from: string; to: string }[] | null | undefined;
  dailyAvailable: { day: string; hours: number }[] | null | undefined;
}

// Mirrors the talent Basic Profile "Partner Program Preference" step — the
// Virtual Office Hours window slider + per-day committed hours. Same component,
// same data model (virtual_office_hours + daily_available_hours).
export default function EditPartnerProgramDialog({
  open,
  onClose,
  userId,
  officeHours,
  dailyAvailable,
}: EditPartnerProgramDialogProps) {
  const [hours, setHours] = useState<DayHours[]>([]);
  const [daily, setDaily] = useState<DayAvailableHours[]>([]);

  useEffect(() => {
    if (!open) return;
    setHours((officeHours ?? []) as DayHours[]);
    setDaily((dailyAvailable ?? []) as DayAvailableHours[]);
  }, [open, officeHours, dailyAvailable]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const handleSave = async () => {
    const cleanedHours = hours.filter((h) => h.from && h.to);
    const cleanedDaily = daily.filter((d) => d.hours > 0);
    try {
      await updateBasic.mutateAsync({
        virtual_office_hours: cleanedHours.length > 0 ? cleanedHours : null,
        daily_available_hours: cleanedDaily.length > 0 ? cleanedDaily : null,
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Partner Program Preference" size="lg">
      <div className="space-y-6">
        <PartnerProgramPreference
          officeHours={hours}
          onOfficeHoursChange={setHours}
          dailyAvailable={daily}
          onDailyAvailableChange={setDaily}
        />
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
