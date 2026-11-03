import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface SaveProgressModalProps {
  open: boolean;
  title?: string;
  description?: string;
  saveLabel?: string;
  discardLabel?: string;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

/**
 * Unsaved-changes prompt shown when leaving a profile form (in-app back
 * button or browser/system back). Offers saving before leaving, discarding,
 * or staying on the form.
 */
export default function SaveProgressModal({
  open,
  title = 'Save your progress?',
  description = 'You have unsaved changes. Save before you leave, or discard them and continue without saving.',
  saveLabel = 'Save & leave',
  discardLabel = 'Leave without saving',
  saving = false,
  onSave,
  onDiscard,
  onKeepEditing,
}: SaveProgressModalProps) {
  return (
    <Modal open={open} onClose={onKeepEditing} title={title}>
      <p className="text-sm leading-relaxed text-[#525252]">{description}</p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <Button variant="primary" onClick={onSave} loading={saving} className="w-full sm:w-auto">
          {saveLabel}
        </Button>
        <Button
          variant="outline"
          onClick={onDiscard}
          disabled={saving}
          className="w-full border-[#0a0a0a]/20 text-[#525252] sm:w-auto"
        >
          {discardLabel}
        </Button>
        <Button
          variant="ghost"
          onClick={onKeepEditing}
          disabled={saving}
          className="w-full text-[#737373] sm:w-auto"
        >
          Keep editing
        </Button>
      </div>
    </Modal>
  );
}
