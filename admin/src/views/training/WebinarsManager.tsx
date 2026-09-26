'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import {
  useWebinars,
  useCreateWebinar,
  useUpdateWebinar,
  useDeleteWebinar,
  useRescheduleWebinar,
  useSetWebinarCompleted,
  type Webinar,
  type WebinarForm,
} from '@/hooks/useWebinars';

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'th', label: 'Thai (ไทย)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'pa', label: 'Punjabi' },
];

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.value === code)?.label ?? code;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Registrant {
  talent_user_id: string;
  full_name: string | null;
  phone: string | null;
  registered_at: string;
  day_notified_at: string | null;
  min30_notified_at: string | null;
  min5_notified_at: string | null;
  webinar_attended_at: string | null;
}

function RegistrantsView({ webinar }: { webinar: Webinar }) {
  const qc = useQueryClient();
  const registrationsKey = ['admin', 'training', 'webinars', webinar.id, 'registrations'];
  const { data, isLoading } = useQuery<Registrant[]>({
    queryKey: registrationsKey,
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/webinars/${webinar.id}/registrations`);
      return data;
    },
  });
  // Ticks the talent's "Webinar attended" item on the Onboarding hub checklist.
  const attendedMut = useMutation({
    mutationFn: async ({ talentUserId, attended }: { talentUserId: string; attended: boolean }) =>
      (await api.patch(`/admin/training/webinars/${webinar.id}/registrations/${talentUserId}/attended`, { attended })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: registrationsKey });
      qc.invalidateQueries({ queryKey: ['onboarding-hub'] });
      qc.invalidateQueries({ queryKey: ['onboarding-journey'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update attendance'),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return <p className="py-6 text-center text-sm text-gray-500">No registrations yet.</p>;
  }

  return (
    <div className="max-h-[50vh] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200">
            <th className="px-4 py-2 text-left font-medium text-gray-500">Talent</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Phone</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Registered</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Reminders</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500" title="Ticks “Webinar attended” on the talent's onboarding checklist">Attended</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((r) => {
            const sent = [r.day_notified_at, r.min30_notified_at, r.min5_notified_at].filter(Boolean).length;
            return (
              <tr key={r.talent_user_id}>
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.full_name ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-500">{r.phone ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-500">
                  {new Date(r.registered_at).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-2.5 text-gray-500">
                  {sent === 0 ? (
                    <span className="text-xs text-gray-400">pending</span>
                  ) : (
                    <span className="text-xs">
                      {sent}/3 sent
                      {r.min5_notified_at ? ' · day ✓ 30m ✓ 5m ✓' : r.min30_notified_at ? ' · day ✓ 30m ✓' : ' · day ✓'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={!!r.webinar_attended_at}
                      disabled={attendedMut.isPending}
                      onChange={(e) => attendedMut.mutate({ talentUserId: r.talent_user_id, attended: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    {r.webinar_attended_at ? 'Yes' : 'No'}
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function RescheduleView({ webinar, onClose }: { webinar: Webinar; onClose: () => void }) {
  const reschedule = useRescheduleWebinar();
  const [startsAt, setStartsAt] = useState(toLocalInput(webinar.starts_at));
  const [meetingLink, setMeetingLink] = useState(webinar.meeting_link);
  const [notify, setNotify] = useState(true);
  const registered = webinar.registrations ?? 0;
  // A completed webinar goes back to published when it's rescheduled.
  const canNotify = (webinar.status === 'published' || webinar.status === 'completed') && registered > 0;
  const newTime = startsAt ? new Date(startsAt) : null;
  const unchanged =
    !!newTime &&
    newTime.getTime() === new Date(webinar.starts_at).getTime() &&
    meetingLink.trim() === webinar.meeting_link;
  const valid = !!newTime && !Number.isNaN(newTime.getTime()) && newTime.getTime() > Date.now() && !unchanged;

  const submit = async () => {
    if (!valid || !newTime) return;
    await reschedule.mutateAsync({
      id: webinar.id,
      starts_at: newTime.toISOString(),
      meeting_link: meetingLink.trim() || undefined,
      notify: canNotify && notify,
    });
    onClose();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
        {new Date(webinar.starts_at).getTime() < Date.now() ? 'Was' : 'Currently'}{' '}
        <span className="font-medium text-gray-900">{formatWhen(webinar.starts_at)}</span>
        {webinar.status === 'completed' && (
          <span className="block text-xs text-gray-500">It moves back to Upcoming and is published again.</span>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">New date and time</label>
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {newTime && newTime.getTime() <= Date.now() && (
          <p className="mt-1 text-xs text-red-600">Pick a time in the future.</p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Meeting link</label>
        <input
          value={meetingLink}
          onChange={(e) => setMeetingLink(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">Change it only if the new slot uses a different link.</p>
      </div>
      {canNotify ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span>
            <span className="font-medium text-gray-900">
              Notify {registered} registered talent{registered === 1 ? '' : 's'}
            </span>
            <span className="block text-xs text-gray-500">
              Notification panel, push and the WhatsApp “webinar rescheduled” template, with the new time in their
              own time zone. They stay registered.
            </span>
          </span>
        </label>
      ) : (
        <p className="text-xs text-gray-500">
          {webinar.status !== 'published'
            ? 'This webinar isn’t published, so nobody is notified.'
            : 'Nobody has registered yet, so there’s no one to notify.'}
        </p>
      )}
      <p className="text-xs text-gray-500">The day, 30 min and 5 min reminders are re-sent for the new time.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={reschedule.isPending || !valid}>
          {reschedule.isPending ? 'Rescheduling…' : canNotify && notify ? 'Reschedule & notify' : 'Reschedule'}
        </Button>
      </div>
    </div>
  );
}

/** Every field starts empty — nothing is pre-selected. */
const EMPTY_FORM: WebinarForm = {
  title: '',
  starts_at: '',
  language: '',
  meeting_link: '',
  audience: '' as WebinarForm['audience'],
  status: '' as WebinarForm['status'],
};

function WebinarFormView({ webinar, onClose }: { webinar?: Webinar | null; onClose: () => void }) {
  const create = useCreateWebinar();
  const update = useUpdateWebinar();
  const [form, setForm] = useState<WebinarForm>(
    webinar
      ? {
          title: webinar.title,
          starts_at: toLocalInput(webinar.starts_at),
          language: webinar.language,
          meeting_link: webinar.meeting_link,
          audience: webinar.audience,
          status: webinar.status,
        }
      : { ...EMPTY_FORM },
  );
  const pending = create.isPending || update.isPending;
  const valid =
    form.title.trim() !== '' &&
    form.starts_at !== '' &&
    form.language !== '' &&
    form.meeting_link.trim() !== '' &&
    (form.audience === 'all' || form.audience === 'thailand') &&
    (form.status === 'draft' || form.status === 'published' || form.status === 'cancelled' || form.status === 'completed');

  const submit = async () => {
    if (!valid) return;
    const payload: WebinarForm = {
      ...form,
      title: form.title.trim(),
      meeting_link: form.meeting_link.trim(),
      // datetime-local has no zone — interpret as entered, send as ISO.
      starts_at: new Date(form.starts_at).toISOString(),
    };
    if (webinar) await update.mutateAsync({ id: webinar.id, ...payload });
    else await create.mutateAsync(payload);
    onClose();
  };

  const set = (k: keyof WebinarForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const selectClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none';

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Webinar name</label>
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Onboarding Q&A for Thailand talents"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Date and time</label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => set('starts_at', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Language</label>
          <select value={form.language} onChange={(e) => set('language', e.target.value)} className={selectClass}>
            <option value="" disabled>
              Select language…
            </option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Meeting link</label>
        <input
          value={form.meeting_link}
          onChange={(e) => set('meeting_link', e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
          <select value={form.audience} onChange={(e) => set('audience', e.target.value)} className={selectClass}>
            <option value="" disabled>
              Select audience…
            </option>
            <option value="thailand">Thailand talents</option>
            <option value="all">Everyone</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={selectClass}>
            <option value="" disabled>
              Select status…
            </option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Registered talents are reminded on the day, 30 min and 5 min before — notification panel + WhatsApp.
        {webinar && ' Changing the time here doesn’t tell them — use Reschedule to notify registered talents.'}
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || !valid}>
          {pending ? 'Saving…' : webinar ? 'Save changes' : 'Create webinar'}
        </Button>
      </div>
    </div>
  );
}

export default function WebinarsManager({ hideHeading = false }: { hideHeading?: boolean } = {}) {
  const { data: webinars, isLoading } = useWebinars();
  const del = useDeleteWebinar();
  const setCompleted = useSetWebinarCompleted();
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Webinar | null>(null);
  const [viewing, setViewing] = useState<Webinar | null>(null);
  const [rescheduling, setRescheduling] = useState<Webinar | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (w: Webinar) => {
    setEditing(w);
    setModalOpen(true);
  };

  const completedCount = (webinars ?? []).filter((w) => w.status === 'completed').length;
  const shown = (webinars ?? [])
    .filter((w) => (tab === 'completed') === (w.status === 'completed'))
    // Completed: most recent first.
    .sort((a, b) => (tab === 'completed' ? -1 : 1) * (new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {!hideHeading ? (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Webinars</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Live sessions for Thailand talents. Registration + reminders are automatic.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Live sessions for Thailand talents. Registration + reminders are automatic.
          </p>
        )}
        <Button onClick={openCreate}>New webinar</Button>
      </div>

      <div className="mb-3 flex gap-1 border-b border-gray-200">
        {(
          [
            ['upcoming', 'Upcoming', (webinars?.length ?? 0) - completedCount],
            ['completed', 'Completed', completedCount],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label} <span className="ml-1 text-xs text-gray-400">{count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-8">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !shown.length ? (
          <div className="p-12 text-center text-gray-500">
            {tab === 'completed' ? (
              <>
                <p className="text-lg font-medium">No completed webinars</p>
                <p className="mt-1 text-sm">Use “Mark completed” on a webinar once it has run.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">No upcoming webinars</p>
                <p className="mt-1 text-sm">Create one — it shows up under Training → Upcoming webinars.</p>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Date & time</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Language</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Meeting link</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Registered</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((w) => (
                <tr key={w.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{w.title}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(w.starts_at).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{languageLabel(w.language)}</td>
                  <td className="max-w-[200px] truncate px-6 py-4">
                    <a
                      href={w.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Open link
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => setViewing(w)}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline"
                      title="See who registered"
                    >
                      {w.registrations ?? 0} · View
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        w.status === 'published' ? 'green' : w.status === 'completed' ? 'blue' : w.status === 'draft' ? 'gray' : 'red'
                      }
                    >
                      {w.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {w.status !== 'completed' && w.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setCompleted.isPending}
                          onClick={() => {
                            if (confirm(
                                `Mark "${w.title}" as completed? It moves to the Completed tab and stops reminders.\n\n` +
                                  `Registrants not ticked as Attended will get a "you missed it — register for the next webinar" message, so tick attendees first.`,
                              ))
                              setCompleted.mutate({ id: w.id, completed: true });
                          }}
                        >
                          Mark completed
                        </Button>
                      )}
                      {w.status !== 'cancelled' && (
                        <Button variant="ghost" size="sm" onClick={() => setRescheduling(w)}>
                          Reschedule
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={del.isPending}
                        onClick={() => {
                          if (confirm(`Delete "${w.title}"? Registrations go with it.`)) del.mutate(w.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit webinar' : 'New webinar'}>
        <WebinarFormView webinar={editing} onClose={() => setModalOpen(false)} />
      </Modal>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Registered — ${viewing.title}` : 'Registered'}
        size="lg"
      >
        {viewing && <RegistrantsView webinar={viewing} />}
      </Modal>

      <Modal
        isOpen={!!rescheduling}
        onClose={() => setRescheduling(null)}
        title={rescheduling ? `Reschedule — ${rescheduling.title}` : 'Reschedule'}
      >
        {rescheduling && <RescheduleView webinar={rescheduling} onClose={() => setRescheduling(null)} />}
      </Modal>
    </div>
  );
}
