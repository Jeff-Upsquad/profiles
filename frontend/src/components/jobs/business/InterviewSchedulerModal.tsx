'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';
import {
  useCreateInterviewRound,
  type JobCandidateForBusiness,
} from '@/hooks/useBusinessJobs';
import { useBusinessLocations, useCreateBusinessLocation } from '@/hooks/useBusinessLocations';

// Interview scheduler: date + time window + minutes/interview ⇒ live capacity
// preview (capacity = floor(window ÷ minutes), server-computed at create).
// Virtual = provider + meeting link (revealed per candidate on Start);
// physical = saved-location dropdown with inline save-new.

const PROVIDERS = [
  { label: 'Google Meet', value: 'meet' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Microsoft Teams', value: 'teams' },
  { label: 'Other', value: 'other' },
];

function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function LocationSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (locationId: string) => void;
}) {
  const { data: locations, isLoading } = useBusinessLocations();
  const createLocation = useCreateBusinessLocation();
  const [addingNew, setAddingNew] = useState(false);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');

  const saveNew = () => {
    if (!label.trim() || !address.trim()) return;
    createLocation.mutate(
      { label: label.trim(), address: address.trim(), maps_url: mapsUrl.trim() || null },
      {
        onSuccess: (loc) => {
          onChange(loc.id);
          setAddingNew(false);
          setLabel('');
          setAddress('');
          setMapsUrl('');
        },
      },
    );
  };

  return (
    <div className="space-y-2">
      <Select
        label="Interview location"
        placeholder={isLoading ? 'Loading saved locations…' : 'Choose a saved location'}
        options={(locations ?? []).map((l) => ({ label: `${l.label} — ${l.address}`, value: l.id }))}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {!addingNew ? (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="text-xs font-semibold text-[#0a0a0a] underline underline-offset-2"
        >
          + Save a new location
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-3">
          <Input label="Label" placeholder="e.g. Head office" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input label="Address" placeholder="Full address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input
            label="Google Maps link (optional)"
            placeholder="https://maps.google.com/…"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddingNew(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              loading={createLocation.isPending}
              disabled={!label.trim() || !address.trim()}
              onClick={saveNew}
            >
              Save location
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewSchedulerModal({
  cardId,
  candidates,
  preselected,
  open,
  onClose,
}: {
  cardId: string;
  /** Invitable pool — typically shortlisted (and re-invitable interview-stage) candidates. */
  candidates: JobCandidateForBusiness[];
  preselected?: string[];
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'virtual' | 'physical'>('virtual');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [provider, setProvider] = useState('meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [locationId, setLocationId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected ?? []));

  const createRound = useCreateInterviewRound(cardId);

  // Live capacity preview — mirrors the server's floor(window / minutes).
  const capacity = useMemo(() => {
    const startMs = windowStart ? new Date(windowStart).getTime() : NaN;
    const endMs = windowEnd ? new Date(windowEnd).getTime() : NaN;
    const mins = Number(minutes);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(mins) || mins <= 0) {
      return null;
    }
    if (endMs <= startMs) return 0;
    return Math.floor((endMs - startMs) / (mins * 60_000));
  }, [windowStart, windowEnd, minutes]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canSubmit =
    selected.size > 0 &&
    !!toIso(windowStart) &&
    !!toIso(windowEnd) &&
    (capacity ?? 0) >= 1 &&
    (mode === 'virtual' || !!locationId);

  const submit = () => {
    if (!canSubmit) {
      if (mode === 'physical' && !locationId) toast.error('Pick or save a location first');
      return;
    }
    createRound.mutate(
      {
        ...(title.trim() ? { title: title.trim() } : {}),
        mode,
        window_start: toIso(windowStart)!,
        window_end: toIso(windowEnd)!,
        minutes_per_interview: Math.max(1, Math.round(Number(minutes))),
        ...(mode === 'virtual'
          ? {
              meeting_provider: provider as 'meet' | 'zoom' | 'teams' | 'other',
              ...(meetingLink.trim() ? { meeting_link: meetingLink.trim() } : {}),
            }
          : { location_id: locationId }),
        candidate_ids: Array.from(selected),
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Schedule interview round">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Input
          label="Round title (optional)"
          placeholder="e.g. Portfolio review"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Mode toggle */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-[#3F3F46]">Interview type</p>
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-1">
            {(['virtual', 'physical'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                  mode === m ? 'bg-white text-[#0a0a0a] shadow-sm' : 'text-[#525252]'
                }`}
              >
                {m === 'virtual' ? 'Virtual' : 'In person'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Window starts"
            type="datetime-local"
            value={windowStart}
            onChange={(e) => setWindowStart(e.target.value)}
            required
          />
          <Input
            label="Window ends"
            type="datetime-local"
            value={windowEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
          <Input
            label="Minutes per interview"
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            required
          />
          {/* Live capacity preview */}
          <div
            className={`rounded-xl border px-4 py-2.5 text-sm ${
              capacity == null
                ? 'border-[#E7E7EA] bg-[#F5F5F6] text-[#737373]'
                : capacity < 1
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {capacity == null
              ? 'Set the window + minutes to see capacity'
              : capacity < 1
                ? 'Window is shorter than one interview slot'
                : `Capacity: ${capacity} interview${capacity === 1 ? '' : 's'}`}
          </div>
        </div>

        {mode === 'virtual' ? (
          <div className="space-y-3">
            <Select
              label="Meeting provider"
              options={PROVIDERS}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
            <Input
              label="Meeting link"
              placeholder="https://meet.google.com/…"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              helperText="Candidates never see this link — it's revealed per candidate only when you click Start Interview."
            />
          </div>
        ) : (
          <LocationSelect value={locationId} onChange={setLocationId} />
        )}

        {/* Candidate picker */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-[#3F3F46]">
            Candidates to invite ({selected.size} selected)
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] px-4 py-3 text-sm text-[#737373]">
              No shortlisted candidates to invite yet.
            </p>
          ) : (
            <ul className="max-h-48 divide-y divide-[#E7E7EA] overflow-y-auto rounded-xl border border-[#E7E7EA]">
              {candidates.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-[#F5F5F6]">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 rounded border-[#D4D4D4] accent-[#0a0a0a]"
                    />
                    <span className="text-sm font-medium text-[#0a0a0a]">
                      {c.talent_name || 'Unknown talent'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {capacity != null && capacity >= 1 && selected.size > capacity && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            You&apos;re inviting more candidates ({selected.size}) than the window fits ({capacity}).
            On the day, confirmations are first-come-first-served — the overflow goes to a waiting
            list and is promoted on no-shows.
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-[#E7E7EA] pt-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" loading={createRound.isPending} disabled={!canSubmit} onClick={submit}>
          Schedule &amp; notify candidates
        </Button>
      </div>
    </Modal>
  );
}
