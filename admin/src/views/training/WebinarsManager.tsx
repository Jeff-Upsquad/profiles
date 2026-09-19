'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import {
  useWebinars,
  useCreateWebinar,
  useUpdateWebinar,
  useDeleteWebinar,
  type Webinar,
  type WebinarForm,
} from '@/hooks/useWebinars';

const LANGUAGES = [
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WebinarFormView({ webinar, onClose }: { webinar?: Webinar | null; onClose: () => void }) {
  const create = useCreateWebinar();
  const update = useUpdateWebinar();
  const [form, setForm] = useState<WebinarForm>({
    title: webinar?.title ?? '',
    starts_at: webinar ? toLocalInput(webinar.starts_at) : '',
    language: webinar?.language ?? 'th',
    meeting_link: webinar?.meeting_link ?? '',
    audience: webinar?.audience ?? 'thailand',
    status: webinar?.status ?? 'published',
  });
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    if (!form.title.trim() || !form.starts_at || !form.meeting_link.trim()) return;
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
          <select
            value={form.language}
            onChange={(e) => set('language', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
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
          <select
            value={form.audience}
            onChange={(e) => set('audience', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="thailand">Thailand talents</option>
            <option value="all">Everyone</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Registered talents are reminded on the day, 30 min and 5 min before — notification panel + WhatsApp.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={pending || !form.title.trim() || !form.starts_at || !form.meeting_link.trim()}
        >
          {pending ? 'Saving…' : webinar ? 'Save changes' : 'Create webinar'}
        </Button>
      </div>
    </div>
  );
}

export default function WebinarsManager() {
  const { data: webinars, isLoading } = useWebinars();
  const del = useDeleteWebinar();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Webinar | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (w: Webinar) => {
    setEditing(w);
    setModalOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Webinars</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Live sessions for Thailand talents. Registration + reminders are automatic.
          </p>
        </div>
        <Button onClick={openCreate}>New webinar</Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-8">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : !webinars?.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No webinars yet</p>
            <p className="mt-1 text-sm">Create the first one — it shows up under Training → Upcoming webinars.</p>
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
              {webinars.map((w) => (
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
                  <td className="px-6 py-4 text-gray-500">{w.language}</td>
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
                  <td className="px-6 py-4 text-gray-500">{w.registrations ?? 0}</td>
                  <td className="px-6 py-4">
                    <Badge variant={w.status === 'published' ? 'green' : w.status === 'draft' ? 'gray' : 'red'}>
                      {w.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
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
    </div>
  );
}
