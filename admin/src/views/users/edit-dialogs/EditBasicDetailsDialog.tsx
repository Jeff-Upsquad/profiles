import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ChipGroup from './ChipGroup';
import {
  useAdminUpdateTalentUser,
  useAdminUpdateBasicProfile,
} from '@/hooks/useAdminTalentEdit';

interface EditBasicDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  email: string | null;
  fullName: string;
  phone: string | null;
  employmentType: ('salary' | 'freelance' | 'partner_program')[];
}

function splitName(fullName: string) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', middle: '', last: '' };
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

function joinName(first: string, middle: string, last: string) {
  return [first, middle, last].map((s) => s.trim()).filter(Boolean).join(' ');
}

const PARTNER_PROGRAM_OPTIONS = [
  { value: 'partner_program', label: 'Subscriptions' },
  { value: 'freelance', label: 'Assignments' },
];

const JOB_OPTIONS = [{ value: 'salary', label: 'Looking for jobs' }];

export default function EditBasicDetailsDialog({
  open,
  onClose,
  userId,
  email,
  fullName,
  phone,
  employmentType,
}: EditBasicDetailsDialogProps) {
  const [first, setFirst] = useState('');
  const [middle, setMiddle] = useState('');
  const [last, setLast] = useState('');
  const [phoneVal, setPhoneVal] = useState('');
  const [employment, setEmployment] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const split = splitName(fullName);
    setFirst(split.first);
    setMiddle(split.middle);
    setLast(split.last);
    setPhoneVal(phone ?? '');
    setEmployment(employmentType ?? []);
  }, [open, fullName, phone, employmentType]);

  const updateUser = useAdminUpdateTalentUser(userId);
  const updateBasic = useAdminUpdateBasicProfile(userId);
  const saving = updateUser.isPending || updateBasic.isPending;

  const handleSave = async () => {
    const newFullName = joinName(first, middle, last);
    if (!newFullName) return;

    try {
      await updateUser.mutateAsync({
        full_name: newFullName,
        phone: phoneVal.trim() || undefined,
      });
      await updateBasic.mutateAsync({
        employment_type: employment.length > 0
          ? (employment as ('salary' | 'freelance' | 'partner_program')[])
          : null,
      });
      onClose();
    } catch {
      // toasts handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Basic Details" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="First Name"
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            required
          />
          <Input
            label="Middle Name"
            value={middle}
            onChange={(e) => setMiddle(e.target.value)}
          />
          <Input
            label="Last Name"
            value={last}
            onChange={(e) => setLast(e.target.value)}
          />
        </div>
        <Input
          label="Email"
          value={email ?? ''}
          disabled
          helperText="Email is the auth identity and can't be edited here."
        />
        <Input
          label="Phone Number"
          value={phoneVal}
          onChange={(e) => setPhoneVal(e.target.value)}
          placeholder="+91…"
        />
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <ChipGroup
            label="Partner Program"
            options={PARTNER_PROGRAM_OPTIONS}
            value={employment.filter((value) => value !== 'salary')}
            multi={false}
            onChange={(partnerOptions) =>
              setEmployment([
                ...partnerOptions,
                ...(employment.includes('salary') ? ['salary'] : []),
              ])
            }
          />
          <p className="mt-2 text-xs text-gray-500">
            A talent can choose either Subscriptions or Assignments.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <ChipGroup
            label="Jobs"
            options={JOB_OPTIONS}
            value={employment.filter((value) => value === 'salary')}
            onChange={(jobOptions) =>
              setEmployment([
                ...employment.filter((value) => value !== 'salary'),
                ...jobOptions,
              ])
            }
          />
          <p className="mt-2 text-xs text-gray-500">
            Jobs can be selected independently or alongside the Partner Program.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!first.trim()}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
