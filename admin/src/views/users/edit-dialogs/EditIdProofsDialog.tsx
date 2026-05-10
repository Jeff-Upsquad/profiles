import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FileUploadField from './FileUploadField';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditIdProofsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  initial: {
    aadhaar_number: string | null;
    aadhaar_file_url: string | null;
    pan_number: string | null;
    pan_file_url: string | null;
  };
}

function validateAadhaar(s: string): string | null {
  if (!s) return null;
  return /^\d{12}$/.test(s) ? null : 'Aadhaar must be 12 digits';
}

function validatePan(s: string): string | null {
  if (!s) return null;
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(s.toUpperCase())
    ? null
    : 'PAN must look like ABCDE1234F';
}

export default function EditIdProofsDialog({
  open,
  onClose,
  userId,
  initial,
}: EditIdProofsDialogProps) {
  const [aadhaarNum, setAadhaarNum] = useState('');
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(null);
  const [panNum, setPanNum] = useState('');
  const [panUrl, setPanUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAadhaarNum(initial.aadhaar_number ?? '');
    setAadhaarUrl(initial.aadhaar_file_url ?? null);
    setPanNum(initial.pan_number ?? '');
    setPanUrl(initial.pan_file_url ?? null);
  }, [open, initial]);

  const updateBasic = useAdminUpdateBasicProfile(userId);
  const aadhaarErr = validateAadhaar(aadhaarNum);
  const panErr = validatePan(panNum);

  const handleSave = async () => {
    if (aadhaarErr || panErr) return;
    try {
      await updateBasic.mutateAsync({
        aadhaar_number: aadhaarNum.trim() || null,
        aadhaar_file_url: aadhaarUrl,
        pan_number: panNum.trim().toUpperCase() || null,
        pan_file_url: panUrl,
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit ID Proofs" size="lg">
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Aadhaar</h3>
          <Input
            label="Aadhaar Number"
            value={aadhaarNum}
            onChange={(e) => setAadhaarNum(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            maxLength={12}
            error={aadhaarErr ?? undefined}
          />
          <FileUploadField
            label="Aadhaar Card Copy"
            value={aadhaarUrl}
            onChange={setAadhaarUrl}
            accept="image/*,application/pdf"
            folder="id-proofs"
          />
        </section>
        <section className="space-y-3 border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">PAN</h3>
          <Input
            label="PAN Number"
            value={panNum}
            onChange={(e) => setPanNum(e.target.value.toUpperCase())}
            maxLength={10}
            error={panErr ?? undefined}
            placeholder="ABCDE1234F"
          />
          <FileUploadField
            label="PAN Card Copy"
            value={panUrl}
            onChange={setPanUrl}
            accept="image/*,application/pdf"
            folder="id-proofs"
          />
        </section>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateBasic.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={updateBasic.isPending}
            disabled={!!aadhaarErr || !!panErr}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
