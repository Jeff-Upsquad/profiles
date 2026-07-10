'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useUpdateInterviewRound, type InterviewRoundWithCounts } from '@/hooks/useBusinessJobs';

// Reschedule a scheduled interview round — one date + a start/end time window
// (+ minutes per interview). Saving re-notifies invited candidates server-side.

function splitLocal(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function RescheduleRoundModal({
  round,
  open,
  onClose,
}: {
  round: InterviewRoundWithCounts;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateInterviewRound();
  const [date, setDate] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [minutes, setMinutes] = useState('30');

  // Prefill from the current round each time the modal opens.
  useEffect(() => {
    if (!open) return;
    const s = splitLocal(round.window_start);
    const e = splitLocal(round.window_end);
    setDate(s.date);
    setStart(s.time);
    setEnd(e.time);
    setMinutes(String(round.minutes_per_interview ?? 30));
  }, [open, round]);

  const startAt = date && start ? new Date(`${date}T${start}`) : null;
  const endAt = date && end ? new Date(`${date}T${end}`) : null;
  const mins = Math.max(1, Math.round(Number(minutes) || 0));
  const validTimes =
    !!startAt && !!endAt && Number.isFinite(startAt.getTime()) && endAt.getTime() > startAt.getTime();
  const capacity = validTimes
    ? Math.floor((endAt!.getTime() - startAt!.getTime()) / 60000 / mins)
    : 0;
  const valid = validTimes && mins > 0;

  const submit = () => {
    if (!valid) return;
    update.mutate(
      {
        roundId: round.id,
        patch: {
          window_start: startAt!.toISOString(),
          window_end: endAt!.toISOString(),
          minutes_per_interview: mins,
        },
      },
      {
        onSuccess: () => {
          toast.success('Interview rescheduled — candidates notified');
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={`Reschedule round ${round.round_no}`}>
      <p className="mb-3 text-sm text-[#525252]">
        Set a new date and time window. Invited candidates are notified of the change.
      </p>
      <div className="space-y-3">
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start time" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="End time" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Input
          label="Minutes per interview"
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <p className="text-xs text-[#737373]">
          {validTimes
            ? `Capacity: ${capacity} interview${capacity === 1 ? '' : 's'} in this window`
            : 'Set a valid start and end time (end after start).'}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" loading={update.isPending} disabled={!valid} onClick={submit}>
          Reschedule &amp; notify
        </Button>
      </div>
    </Modal>
  );
}
