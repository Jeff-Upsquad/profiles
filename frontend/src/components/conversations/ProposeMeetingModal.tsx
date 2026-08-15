'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { IntroMeetingProvider } from '../../../../shared/src/types/conversations';

export default function ProposeMeetingModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    starts_at: string;
    ends_at?: string;
    timezone?: string;
    provider: IntroMeetingProvider;
    meeting_link: string;
  }) => void;
  loading?: boolean;
}) {
  const [startsLocal, setStartsLocal] = useState('');
  const [endsLocal, setEndsLocal] = useState('');
  const [provider, setProvider] = useState<IntroMeetingProvider>('meet');
  const [link, setLink] = useState('');

  const submit = () => {
    if (!startsLocal || !link.trim()) return;
    const starts = new Date(startsLocal);
    if (Number.isNaN(starts.getTime())) return;
    const ends = endsLocal ? new Date(endsLocal) : null;
    onSubmit({
      starts_at: starts.toISOString(),
      ends_at: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      provider,
      meeting_link: link.trim(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Propose a meeting">
      <div className="space-y-3">
        <Input
          type="datetime-local"
          label="Starts"
          value={startsLocal}
          onChange={(e) => setStartsLocal(e.target.value)}
        />
        <Input
          type="datetime-local"
          label="Ends (optional)"
          value={endsLocal}
          onChange={(e) => setEndsLocal(e.target.value)}
        />
        <Select
          label="Provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value as IntroMeetingProvider)}
          options={[
            { value: 'meet', label: 'Google Meet' },
            { value: 'zoom', label: 'Zoom' },
            { value: 'teams', label: 'Microsoft Teams' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Input
          label="Meeting link"
          placeholder="https://meet.google.com/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading} disabled={!startsLocal || !link.trim()}>
            Send invite
          </Button>
        </div>
      </div>
    </Modal>
  );
}
