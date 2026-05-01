import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ChapterForm from './ChapterForm';
import {
  useChapters,
  useDeleteChapter,
  type TrainingChapter,
} from '@/hooks/useTraining';

export default function TrainingChapterList() {
  const { data: chapters, isLoading } = useChapters();
  const deleteMutation = useDeleteChapter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<TrainingChapter | null>(null);

  const openCreate = () => {
    setEditingChapter(null);
    setModalOpen(true);
  };

  const openEdit = (ch: TrainingChapter) => {
    setEditingChapter(ch);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingChapter(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Training Program</h1>
        <Button onClick={openCreate}>Create Chapter</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : !chapters?.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No chapters yet</p>
            <p className="text-sm mt-1">Create your first chapter to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Title</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Categories</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Language</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Lessons</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Sort</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chapters.map((ch) => (
                <tr key={ch.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/training/${ch.id}`}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        {ch.title}
                      </Link>
                      {ch.is_onboarding && (
                        <Badge variant="indigo">Onboarding</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {ch.categories.map((cat) => (
                        <Badge key={cat.id} variant="blue">
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 uppercase text-xs font-medium">{ch.language ?? 'en'}</td>
                  <td className="px-6 py-4 text-gray-500">{ch.lesson_count}</td>
                  <td className="px-6 py-4">
                    <Badge variant={ch.is_active ? 'green' : 'gray'}>
                      {ch.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{ch.sort_order}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(ch)}>
                        Edit
                      </Button>
                      <Link href={`/training/${ch.id}`}>
                        <Button variant="ghost" size="sm">
                          Lessons
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this chapter and all its lessons?')) {
                            deleteMutation.mutate(ch.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
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

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingChapter ? 'Edit Chapter' : 'Create Chapter'}
      >
        <ChapterForm chapter={editingChapter} onClose={closeModal} />
      </Modal>
    </div>
  );
}
