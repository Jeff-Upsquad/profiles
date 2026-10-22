'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';

type Track = 'partner' | 'jobs';
type Actor = 'applicant' | 'admin';
type Unit = 'hours' | 'days';

interface StageRule {
  enabled: boolean;
  amount: number;
  unit: Unit;
  actor: Actor;
  cancel_after_days: number;
}

interface TrackSettings {
  enabled: boolean;
  activated_at: string | null;
  stages: Record<string, StageRule>;
}

// Mirrors backend/src/lib/stage-timers.ts (TIMED_STAGES / STAGE_TASKS).
const STAGES: { key: string; label: string; next: string }[] = [
  { key: 'applicants', label: 'Signed Up / Applicants', next: 'Application reviewed (approve / reject)' },
  { key: 'application_approved', label: 'Application Approved', next: 'Onboarding course completed' },
  { key: 'onboarding_course', label: 'Onboarding Course', next: 'Basic profile completed' },
  { key: 'basic_profile', label: 'Basic Profile', next: 'Job profile completed' },
  { key: 'job_profile', label: 'Job Profile', next: 'Portfolio done, profile submitted for review' },
  { key: 'final_review', label: 'Final Review', next: 'Job profile reviewed' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function StageTimerSettings({ track }: { track: Track }) {
  const qc = useQueryClient();
  const { can, isFullAdmin } = useAuth();
  const canEdit = isFullAdmin || can('approvals', 'edit');
  const program = track === 'jobs' ? 'Jobs' : 'Partner Program';
  const hubHref = track === 'jobs' ? '/jobs-onboarding' : '/approvals';

  const { data, isLoading } = useQuery<{ settings: TrackSettings }>({
    queryKey: ['stage-timers', track],
    queryFn: async () => (await api.get('/admin/user-approvals/stage-timers', { params: { track } })).data,
  });

  const [draft, setDraft] = useState<TrackSettings | null>(null);
  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async (settings: TrackSettings) =>
      (await api.put('/admin/user-approvals/stage-timers', { track, settings })).data,
    onSuccess: (res: { settings: TrackSettings }) => {
      toast.success('Stage timers saved');
      setDraft(res.settings);
      qc.setQueryData(['stage-timers', track], res);
      qc.invalidateQueries({ queryKey: ['onboarding-hub'] });
      qc.invalidateQueries({ queryKey: ['onboarding-hub-stats'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Save failed'),
  });

  const setRule = (key: string, patch: Partial<StageRule>) =>
    setDraft((d) => (d ? { ...d, stages: { ...d.stages, [key]: { ...d.stages[key], ...patch } } } : d));

  const dirty = !!draft && !!data && JSON.stringify(draft) !== JSON.stringify(data.settings);

  if (isLoading || !draft) {
    return <div className="py-16 text-center text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={hubHref} className="text-xs font-medium text-indigo-600 hover:underline">← {program} Onboarding</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{program} Onboarding · Settings</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Give each stage a time limit and say whose move it is. When the <b>applicant</b> misses the limit, their
            {' '}{program} application becomes <b>inactive</b> (they are locked out until they reactivate), and is
            {' '}<b>cancelled</b> if they don&apos;t reactivate in time. When it&apos;s <b>our</b> move, the hub flags the
            applicant as overdue. Applicants under request changes are paused until they are back in the normal flow.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => saveMut.mutate(draft)}
            disabled={!dirty || saveMut.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveMut.isPending ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
          checked={draft.enabled}
          disabled={!canEdit}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-semibold text-gray-900">Stage timers are {draft.enabled ? 'on' : 'off'}</span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {draft.enabled && draft.activated_at
              ? `On since ${formatDate(draft.activated_at)}. Applicants already in a stage then were timed from that moment.`
              : 'When switched on, applicants already in a stage start their clock from that moment — nobody goes inactive straight away.'}
          </span>
        </span>
      </label>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2.5">Stage</th>
              <th className="px-4 py-2.5">Timer</th>
              <th className="px-4 py-2.5">Complete within</th>
              <th className="px-4 py-2.5">Who acts</th>
              <th className="px-4 py-2.5">Cancel after inactive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {STAGES.map((s) => {
              const r = draft.stages[s.key];
              if (!r) return null;
              const off = !r.enabled;
              return (
                <tr key={s.key} className={off ? 'bg-gray-50/60' : ''}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{s.label}</p>
                    <p className="text-xs text-gray-500">Next: {s.next}</p>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      checked={r.enabled}
                      disabled={!canEdit}
                      onChange={(e) => setRule(s.key, { enabled: e.target.checked })}
                      aria-label={`Timer for ${s.label}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={r.unit === 'hours' ? 720 : 90}
                        value={r.amount}
                        disabled={!canEdit || off}
                        onChange={(e) => setRule(s.key, { amount: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                      />
                      <select
                        value={r.unit}
                        disabled={!canEdit || off}
                        onChange={(e) => setRule(s.key, { unit: e.target.value as Unit })}
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                      >
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.actor}
                      disabled={!canEdit || off}
                      onChange={(e) => setRule(s.key, { actor: e.target.value as Actor })}
                      className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                    >
                      <option value="applicant">Applicant</option>
                      <option value="admin">Admin (us)</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {r.actor === 'applicant' ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={r.cancel_after_days}
                          disabled={!canEdit || off}
                          onChange={(e) => setRule(s.key, { cancel_after_days: Math.max(1, Number(e.target.value) || 1) })}
                          className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
                        />
                        <span className="text-sm text-gray-600">days</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Flagged as overdue only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-600">
        <p className="font-semibold text-gray-800">What the applicant receives</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>On entering a timed stage: <i>&ldquo;Next step: complete your basic profile. Please complete it within 2 days…&rdquo;</i> — in the talent app and on WhatsApp. The time in the message always follows these settings.</li>
          <li>On going inactive (or when you click <b>Mark inactive</b>): a notice that they have N days to reactivate before cancellation.</li>
          <li>On cancellation: a notice in the app and on WhatsApp; they move to Cancelled Applicants and the CRM card to the Cancelled board.</li>
        </ul>
      </div>
    </div>
  );
}
