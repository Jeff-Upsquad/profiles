'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAdminNotifications,
  useCreateNotification,
  useDeleteNotification,
  usePreviewRecipients,
  type AdminNotification,
  type NotificationFilters,
  type NotificationMediaItem,
} from '@/hooks/useNotifications';
import { useUpload } from '@/hooks/useUpload';
import { formatDate } from '@/lib/formatDate';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
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

const GENDER_OPTIONS = ['male', 'female', 'other'];

const LOOM_URL_RE = /^https:\/\/(www\.)?loom\.com\/(share|embed)\/[\w-]+/;

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function MediaThumb({ item }: { item: NotificationMediaItem }) {
  if (item.type === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.url} alt={item.name ?? 'image'} className="h-12 w-12 rounded-md object-cover border border-gray-200" />;
  }
  if (item.type === 'pdf') {
    return (
      <div className="h-12 w-12 rounded-md border border-gray-200 bg-red-50 text-red-600 text-[10px] font-semibold flex items-center justify-center">
        PDF
      </div>
    );
  }
  return (
    <div className="h-12 w-12 rounded-md border border-gray-200 bg-purple-50 text-purple-600 text-[10px] font-semibold flex items-center justify-center">
      LOOM
    </div>
  );
}

function filterSummary(f: NotificationFilters | null | undefined): string {
  if (!f || Object.keys(f).length === 0) return 'All talent users';
  const parts: string[] = [];
  if (f.approval_status?.length) parts.push(`status: ${f.approval_status.join('/')}`);
  if (typeof f.is_active === 'boolean') parts.push(f.is_active ? 'active only' : 'inactive only');
  if (f.gender?.length) parts.push(`gender: ${f.gender.join('/')}`);
  if (f.languages?.length) parts.push(`langs: ${f.languages.join(', ')}`);
  if (f.location_contains) parts.push(`location ~ "${f.location_contains}"`);
  return parts.length > 0 ? parts.join(' · ') : 'All talent users';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NotificationManager() {
  const { data: list = [], isLoading } = useAdminNotifications();
  const createMutation = useCreateNotification();
  const deleteMutation = useDeleteNotification();

  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<AdminNotification | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminNotification | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Send announcements with text, images, PDFs, or Loom videos to talent users.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New notification</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No notifications yet</h3>
          <p className="mt-1 text-sm text-gray-500">Send your first announcement to talent users.</p>
          <div className="mt-4">
            <Button size="sm" onClick={() => setModalOpen(true)}>Create notification</Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Targeted</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sent / Read</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Media</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Sent</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {list.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    <div className="font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-gray-500 truncate">{n.body}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 max-w-xs">{filterSummary(n.target_filters)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className="font-semibold text-gray-900">{n.read_count}</span>
                    <span className="text-gray-400"> / {n.recipient_count}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {n.media.length === 0 ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <>
                          {n.media.slice(0, 3).map((m, i) => (
                            <MediaThumb key={i} item={m} />
                          ))}
                          {n.media.length > 3 && (
                            <span className="text-xs text-gray-500">+{n.media.length - 3}</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-xs text-gray-500">{relativeTime(n.created_at)}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setViewing(n)}>View</Button>
                      <Button variant="danger" size="sm" onClick={() => setConfirmDelete(n)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload);
          setModalOpen(false);
        }}
        submitting={createMutation.isPending}
      />

      <ViewModal notification={viewing} onClose={() => setViewing(null)} />

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete notification">
        <p className="text-sm text-gray-600">
          Delete <strong>{confirmDelete?.title}</strong>? This also removes it from every recipient&rsquo;s inbox. Cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={async () => {
              if (!confirmDelete) return;
              await deleteMutation.mutateAsync(confirmDelete.id);
              setConfirmDelete(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View Modal
// ---------------------------------------------------------------------------

function loomEmbedUrl(url: string): string {
  // Convert /share/<id> to /embed/<id>; pass through if already embed.
  const m = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  return m ? `https://www.loom.com/embed/${m[1]}` : url;
}

function ViewModal({ notification, onClose }: { notification: AdminNotification | null; onClose: () => void }) {
  return (
    <Modal isOpen={!!notification} onClose={onClose} title={notification?.title ?? ''} size="lg">
      {notification && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Badge variant="gray">{filterSummary(notification.target_filters)}</Badge>
            <span>·</span>
            <span>
              Read by <strong>{notification.read_count}</strong> of <strong>{notification.recipient_count}</strong>
            </span>
            <span>·</span>
            <span>{relativeTime(notification.created_at)}</span>
          </div>
          {notification.body && (
            <p className="whitespace-pre-wrap text-sm text-gray-700">{notification.body}</p>
          )}
          {notification.link_url && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              <a href={notification.link_url} target="_blank" rel="noopener noreferrer" className="truncate text-sm text-indigo-600 hover:underline">
                {notification.link_url}
              </a>
            </div>
          )}
          {notification.media.length > 0 && (
            <div className="space-y-3">
              {notification.media.map((m, i) => (
                <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                  {m.type === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.name ?? 'image'} className="w-full max-h-96 object-contain bg-gray-50" />
                  )}
                  {m.type === 'pdf' && (
                    <div className="flex items-center justify-between gap-3 p-3 bg-red-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-red-600 font-semibold text-xs">PDF</span>
                        <span className="text-sm text-gray-700 truncate">{m.name ?? m.url.split('/').pop()}</span>
                      </div>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">Open</a>
                    </div>
                  )}
                  {m.type === 'loom' && (
                    <div className="relative" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        src={loomEmbedUrl(m.url)}
                        className="absolute inset-0 h-full w-full"
                        allowFullScreen
                        title={m.name ?? 'Loom video'}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

function CreateModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (p: {
    title: string;
    body?: string;
    media: NotificationMediaItem[];
    filters: NotificationFilters;
    link_url?: string;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<NotificationMediaItem[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [loomInput, setLoomInput] = useState('');

  // Filters
  const [approvalStatus, setApprovalStatus] = useState<Array<'pending' | 'approved' | 'rejected'>>([]);
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [gender, setGender] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [locationContains, setLocationContains] = useState('');

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setBody('');
    setMedia([]);
    setLinkUrl('');
    setLoomInput('');
    setApprovalStatus([]);
    setActiveFilter('');
    setGender([]);
    setLanguages([]);
    setLocationContains('');
  }, [isOpen]);

  const filters: NotificationFilters = useMemo(() => {
    const f: NotificationFilters = {};
    if (approvalStatus.length > 0) f.approval_status = approvalStatus;
    if (activeFilter !== '') f.is_active = activeFilter === 'true';
    if (gender.length > 0) f.gender = gender;
    if (languages.length > 0) f.languages = languages;
    if (locationContains.trim()) f.location_contains = locationContains.trim();
    return f;
  }, [approvalStatus, activeFilter, gender, languages, locationContains]);

  // Preview recipient count whenever filters change (debounced).
  const previewMutation = usePreviewRecipients();
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      previewMutation.mutate(filters);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, isOpen]);
  const recipientCount = previewMutation.data?.count;

  // Uploads
  const { uploadFile, uploading } = useUpload();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File, type: 'image' | 'pdf') {
    try {
      const url = await uploadFile(file, 'notifications');
      setMedia((m) => [...m, { type, url, name: file.name }]);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    }
  }

  function addLoom() {
    const url = loomInput.trim();
    if (!url) return;
    if (!LOOM_URL_RE.test(url)) {
      toast.error('Please enter a valid Loom share URL');
      return;
    }
    setMedia((m) => [...m, { type: 'loom', url }]);
    setLoomInput('');
  }

  function removeMedia(idx: number) {
    setMedia((m) => m.filter((_, i) => i !== idx));
  }

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  const hasContent = body.trim().length > 0 || media.length > 0;
  const canSubmit = title.trim().length > 0 && hasContent && !submitting && !uploading;

  async function submit() {
    await onSubmit({
      title: title.trim(),
      body: body.trim() || undefined,
      media,
      filters,
      link_url: linkUrl.trim() || undefined,
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New notification" size="lg">
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="e.g. New training videos available"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Body (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Plain text. Newlines are preserved."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Link */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Link (optional)</label>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            maxLength={2048}
            placeholder="https://… or /talent/training — tapping the notification opens this"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            In-app pages open inside the app; other URLs open in the browser.
          </p>
        </div>

        {/* Media */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Media (optional)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => imageInputRef.current?.click()}
              loading={uploading}
            >
              + Image
            </Button>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              loading={uploading}
            >
              + PDF
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f, 'image');
                e.target.value = '';
              }}
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f, 'pdf');
                e.target.value = '';
              }}
            />
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={loomInput}
              onChange={(e) => setLoomInput(e.target.value)}
              placeholder="Paste a Loom share URL"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLoom();
                }
              }}
            />
            <Button variant="secondary" size="sm" type="button" onClick={addLoom} disabled={!loomInput.trim()}>
              + Loom
            </Button>
          </div>

          {media.length > 0 && (
            <ul className="mt-3 space-y-2">
              {media.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <MediaThumb item={m} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase text-gray-500">{m.type}</div>
                      <div className="text-sm text-gray-700 truncate">{m.name ?? m.url}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="text-gray-400 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Send to</h3>
            <span className="text-xs text-gray-500">
              {recipientCount === undefined ? 'Calculating…' : (
                <>
                  <strong className="text-gray-900">{recipientCount}</strong>{' '}
                  {recipientCount === 1 ? 'talent user' : 'talent users'} match
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Approval status */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">Approval status</div>
              <div className="flex flex-wrap gap-1.5">
                {(['pending', 'approved', 'rejected'] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setApprovalStatus((a) => toggle(a, s))}
                    className={`px-2.5 py-1 text-xs rounded-full border ${
                      approvalStatus.includes(s)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Active */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">Account state</div>
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as '' | 'true' | 'false')}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Any</option>
                <option value="true">Active only</option>
                <option value="false">Inactive only</option>
              </select>
            </div>

            {/* Gender */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">Gender</div>
              <div className="flex flex-wrap gap-1.5">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setGender((arr) => toggle(arr, g))}
                    className={`px-2.5 py-1 text-xs rounded-full border capitalize ${
                      gender.includes(g)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Location contains */}
            <div>
              <div className="text-xs font-medium text-gray-700 mb-1">Location contains</div>
              <input
                type="text"
                value={locationContains}
                onChange={(e) => setLocationContains(e.target.value)}
                placeholder="e.g. Tamil Nadu"
                className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Languages */}
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-gray-700 mb-1">Languages spoken (any of)</div>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGE_OPTIONS.map((l) => (
                  <button
                    type="button"
                    key={l.value}
                    onClick={() => setLanguages((arr) => toggle(arr, l.value))}
                    className={`px-2.5 py-1 text-xs rounded-full border ${
                      languages.includes(l.value)
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            No filters selected → sends to <strong>every</strong> talent user.
          </p>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={submitting} disabled={!canSubmit}>
            Send {recipientCount !== undefined && recipientCount > 0 ? `to ${recipientCount}` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
