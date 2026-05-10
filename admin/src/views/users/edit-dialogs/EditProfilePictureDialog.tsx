import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import FileUploadField from './FileUploadField';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditProfilePictureDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  url: string | null;
}

export default function EditProfilePictureDialog({
  open,
  onClose,
  userId,
  url,
}: EditProfilePictureDialogProps) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(url ?? null);
  }, [open, url]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const handleSave = async () => {
    try {
      await updateBasic.mutateAsync({ profile_picture_url: value });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Profile Picture" size="md">
      <div className="space-y-4">
        {value && (
          <div className="flex justify-center">
            <img
              src={value}
              alt="Profile preview"
              className="h-32 w-32 rounded-full object-cover ring-2 ring-gray-200"
            />
          </div>
        )}
        <FileUploadField
          value={value}
          onChange={setValue}
          accept="image/*"
          folder="profile-pictures"
        />
        <p className="text-xs text-gray-500">
          The new picture is also synced to the talent's auth profile so it
          shows in their job-profile cards.
        </p>
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
