import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface ExperienceEntry {
  from_year: number;
  from_month: number;
  to_year: number;
  to_month: number;
  company_name: string;
  designation: string;
}

interface EditExperienceDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  entries: ExperienceEntry[] | null | undefined;
}

const MONTHS = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => {
  const y = CURRENT_YEAR + 5 - i;
  return { value: String(y), label: String(y) };
});

function blankEntry(): ExperienceEntry {
  return {
    from_year: CURRENT_YEAR,
    from_month: 1,
    to_year: CURRENT_YEAR,
    to_month: 12,
    company_name: '',
    designation: '',
  };
}

export default function EditExperienceDialog({
  open,
  onClose,
  userId,
  entries,
}: EditExperienceDialogProps) {
  const [list, setList] = useState<ExperienceEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setList(entries && entries.length > 0 ? entries : []);
  }, [open, entries]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const update = (i: number, patch: Partial<ExperienceEntry>) => {
    setList(list.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const remove = (i: number) => {
    setList(list.filter((_, idx) => idx !== i));
  };

  const add = () => {
    setList([...list, blankEntry()]);
  };

  const handleSave = async () => {
    const cleaned = list
      .filter((e) => e.company_name.trim() || e.designation.trim())
      .map((e) => ({
        ...e,
        company_name: e.company_name.trim(),
        designation: e.designation.trim(),
      }));
    try {
      await updateBasic.mutateAsync({
        experience: cleaned.length > 0 ? cleaned : null,
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Experience" size="lg">
      <div className="space-y-4">
        {list.length === 0 && (
          <p className="text-sm text-gray-500">No experience added yet.</p>
        )}
        {list.map((entry, i) => (
          <div
            key={i}
            className="rounded-lg border border-gray-200 p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">
                Experience #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
            <Input
              label="Company Name"
              value={entry.company_name}
              onChange={(e) => update(i, { company_name: e.target.value })}
            />
            <Input
              label="Designation"
              value={entry.designation}
              onChange={(e) => update(i, { designation: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="From (Month)"
                  options={MONTHS}
                  value={String(entry.from_month)}
                  onChange={(e) => update(i, { from_month: Number(e.target.value) })}
                />
                <Select
                  label="From (Year)"
                  options={YEARS}
                  value={String(entry.from_year)}
                  onChange={(e) => update(i, { from_year: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="To (Month)"
                  options={MONTHS}
                  value={String(entry.to_month)}
                  onChange={(e) => update(i, { to_month: Number(e.target.value) })}
                />
                <Select
                  label="To (Year)"
                  options={YEARS}
                  value={String(entry.to_year)}
                  onChange={(e) => update(i, { to_year: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          + Add Experience
        </button>

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
