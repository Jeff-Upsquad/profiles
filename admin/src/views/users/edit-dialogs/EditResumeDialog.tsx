import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FileUploadField from './FileUploadField';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditResumeDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  url: string | null;
}

export default function EditResumeDialog({
  open,
  onClose,
  userId,
  url,
}: EditResumeDialogProps) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(url ?? null);
  }, [open, url]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const handleSave = async () => {
    try {
      await updateBasic.mutateAsync({ resume_url: value });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Resume" size="md">
      <div className="space-y-4">
        <FileUploadField
          label="Resume (PDF)"
          value={value}
          onChange={setValue}
          accept="application/pdf"
          folder="resumes"
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
