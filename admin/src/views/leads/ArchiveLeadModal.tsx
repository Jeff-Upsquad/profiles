'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const ARCHIVE_REASONS: { value: string; label: string }[] = [
  { value: 'not_qualified', label: 'Not qualified' },
  { value: 'not_responsive', label: 'Not responsive' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Other' },
];

interface Props {
  isOpen: boolean;
  leadName: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (reason: string, note: string) => void;
}

export default function ArchiveLeadModal({
  isOpen,
  leadName,
  pending,
  onClose,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }
    if (!note.trim()) {
      setError('Please add a note explaining why');
      return;
    }
    setError('');
    onSubmit(reason, note);
  };

  const handleClose = () => {
    setReason('');
    setNote('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Archive Lead">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Archiving <span className="font-medium text-gray-900">{leadName}</span>. Please share a
          reason so the team knows why.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Reason <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select a reason...</option>
            {ARCHIVE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Note <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Explain why this profile is being archived..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={pending} onClick={handleSubmit}>
            Archive
          </Button>
        </div>
      </div>
    </Modal>
  );
}
