'use client';

import { useState } from 'react';
import {
  useHowItWorksVideos,
  useCreateHowItWorksVideo,
  useUpdateHowItWorksVideo,
  useDeleteHowItWorksVideo,
  type HowItWorksVideo,
} from '@/hooks/useHowItWorks';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';

const LANGUAGE_OPTIONS = [
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

function languageLabel(code: string) {
  return LANGUAGE_OPTIONS.find((l) => l.value === code)?.label ?? code.toUpperCase();
}

export default function HowItWorksVideoManager() {
  const { data: videos = [], isLoading } = useHowItWorksVideos();
  const createVideo = useCreateHowItWorksVideo();
  const updateVideo = useUpdateHowItWorksVideo();
  const deleteVideo = useDeleteHowItWorksVideo();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<HowItWorksVideo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<HowItWorksVideo | null>(null);

  const [language, setLanguage] = useState('en');
  const [loomUrl, setLoomUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  const usedLanguages = new Set(videos.map((v) => v.language));

  const openCreate = () => {
    setEditing(null);
    const firstAvailable = LANGUAGE_OPTIONS.find((l) => !usedLanguages.has(l.value));
    setLanguage(firstAvailable?.value ?? 'en');
    setLoomUrl('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (video: HowItWorksVideo) => {
    setEditing(video);
    setLanguage(video.language);
    setLoomUrl(video.loom_url);
    setIsActive(video.is_active);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (editing) {
      await updateVideo.mutateAsync({ id: editing.id, language, loom_url: loomUrl, is_active: isActive });
    } else {
      await createVideo.mutateAsync({ language, loom_url: loomUrl, is_active: isActive });
    }
    setModalOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteVideo.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  };

  const availableLanguages = editing
    ? LANGUAGE_OPTIONS
    : LANGUAGE_OPTIONS.filter((l) => !usedLanguages.has(l.value));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">How it works — Videos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage the Loom videos shown to business users on the &ldquo;How it works&rdquo; page.
          </p>
        </div>
        <Button onClick={openCreate} disabled={availableLanguages.length === 0}>
          Add video
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No videos yet</h3>
          <p className="mt-1 text-sm text-gray-500">Add a Loom video for each language.</p>
          <div className="mt-4">
            <Button size="sm" onClick={openCreate}>
              Add first video
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Language</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Loom URL</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {videos.map((video) => (
                <tr key={video.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {languageLabel(video.language)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <a
                      href={video.loom_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 hover:underline truncate block max-w-xs"
                    >
                      {video.loom_url}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Badge variant={video.is_active ? 'success' : 'default'}>
                      {video.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(video)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setConfirmDelete(video)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit video' : 'Add video'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={!!editing}
              className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-100"
            >
              {(editing ? LANGUAGE_OPTIONS : availableLanguages).map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Loom URL</label>
            <input
              type="url"
              value={loomUrl}
              onChange={(e) => setLoomUrl(e.target.value)}
              placeholder="https://www.loom.com/share/..."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createVideo.isPending || updateVideo.isPending}
              disabled={!loomUrl.trim()}
            >
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete video">
        <p className="text-sm text-gray-600">
          Delete the <strong>{confirmDelete ? languageLabel(confirmDelete.language) : ''}</strong> video? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteVideo.isPending}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
