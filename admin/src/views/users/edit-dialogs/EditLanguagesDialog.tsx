import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LanguagePicker, { type LanguageEntry } from './LanguagePicker';
import { useAdminUpdateTalentUser } from '@/hooks/useAdminTalentEdit';

interface EditLanguagesDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  languages: LanguageEntry[] | null | undefined;
}

export default function EditLanguagesDialog({
  open,
  onClose,
  userId,
  languages,
}: EditLanguagesDialogProps) {
  const [value, setValue] = useState<LanguageEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setValue(languages ?? []);
  }, [open, languages]);

  const updateUser = useAdminUpdateTalentUser(userId);

  const handleSave = async () => {
    const cleaned = value.filter((v) => v.language && v.proficiency);
    try {
      await updateUser.mutateAsync({ languages_spoken: cleaned });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Languages" size="md">
      <div className="space-y-4">
        <LanguagePicker value={value} onChange={setValue} />
        <p className="text-xs text-gray-500">
          Add at least one language. Each language can be picked only once.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateUser.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} loading={updateUser.isPending}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
