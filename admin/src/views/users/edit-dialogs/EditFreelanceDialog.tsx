import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface VirtualHour {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  from: string;
  to: string;
}

interface EditFreelanceDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  hours: VirtualHour[] | null | undefined;
}

const DAYS: VirtualHour['day'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<VirtualHour['day'], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function makeDefault(): VirtualHour[] {
  return DAYS.map((day) => ({ day, from: '', to: '' }));
}

export default function EditFreelanceDialog({
  open,
  onClose,
  userId,
  hours,
}: EditFreelanceDialogProps) {
  const [rows, setRows] = useState<VirtualHour[]>([]);

  useEffect(() => {
    if (!open) return;
    if (hours && hours.length > 0) {
      const map = new Map(hours.map((h) => [h.day, h]));
      setRows(DAYS.map((day) => map.get(day) ?? { day, from: '', to: '' }));
    } else {
      setRows(makeDefault());
    }
  }, [open, hours]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const update = (i: number, patch: Partial<VirtualHour>) => {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    const cleaned = rows.filter((r) => r.from && r.to);
    try {
      await updateBasic.mutateAsync({
        virtual_office_hours: cleaned.length > 0 ? cleaned : null,
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Freelance Preference" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Set virtual office hours per day. Leave both fields empty for days off.
        </p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.day} className="grid grid-cols-3 gap-3 items-center">
              <span className="text-sm font-medium text-gray-700">
                {DAY_LABELS[row.day]}
              </span>
              <input
                type="time"
                value={row.from}
                onChange={(e) => update(i, { from: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="time"
                value={row.to}
                onChange={(e) => update(i, { to: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}
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
