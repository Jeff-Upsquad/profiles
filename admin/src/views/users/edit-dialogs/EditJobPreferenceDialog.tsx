import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ChipGroup from './ChipGroup';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditJobPreferenceDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  initial: {
    availability: string[];
    job_type: string[];
    expected_salary_full_time: number | null;
    expected_salary_part_time: number | null;
  };
}

const AVAILABILITY_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
];

const JOB_TYPE_OPTIONS = [
  { value: 'remote', label: 'Remote' },
  { value: 'office', label: 'Office' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'field', label: 'Field' },
];

function parseSalary(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(/[, ]/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function EditJobPreferenceDialog({
  open,
  onClose,
  userId,
  initial,
}: EditJobPreferenceDialogProps) {
  const [availability, setAvailability] = useState<string[]>([]);
  const [jobType, setJobType] = useState<string[]>([]);
  const [salaryFt, setSalaryFt] = useState('');
  const [salaryPt, setSalaryPt] = useState('');

  useEffect(() => {
    if (!open) return;
    setAvailability(initial.availability ?? []);
    setJobType(initial.job_type ?? []);
    setSalaryFt(
      initial.expected_salary_full_time != null
        ? String(initial.expected_salary_full_time)
        : '',
    );
    setSalaryPt(
      initial.expected_salary_part_time != null
        ? String(initial.expected_salary_part_time)
        : '',
    );
  }, [open, initial]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const handleSave = async () => {
    try {
      await updateBasic.mutateAsync({
        availability: availability.length
          ? (availability as ('full_time' | 'part_time')[])
          : null,
        job_type: jobType.length
          ? (jobType as ('remote' | 'office' | 'hybrid' | 'field')[])
          : null,
        expected_salary_full_time: parseSalary(salaryFt),
        expected_salary_part_time: parseSalary(salaryPt),
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Job Preference" size="lg">
      <div className="space-y-4">
        <ChipGroup
          label="Availability"
          options={AVAILABILITY_OPTIONS}
          value={availability}
          onChange={setAvailability}
        />
        <ChipGroup
          label="Job Type"
          options={JOB_TYPE_OPTIONS}
          value={jobType}
          onChange={setJobType}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Expected Salary (Full-time, ₹)"
            value={salaryFt}
            onChange={(e) => setSalaryFt(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 50000"
          />
          <Input
            label="Expected Salary (Part-time, ₹)"
            value={salaryPt}
            onChange={(e) => setSalaryPt(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 25000"
          />
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
