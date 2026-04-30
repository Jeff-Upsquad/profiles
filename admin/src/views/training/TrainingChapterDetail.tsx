import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import LessonForm from './LessonForm';
import {
  useChapter,
  useLessons,
  useDeleteLesson,
  type TrainingLesson,
} from '@/hooks/useTraining';

interface Props {
  chapterId: string;
}

export default function TrainingChapterDetail({ chapterId }: Props) {
  const { data: chapter, isLoading: chapterLoading } = useChapter(chapterId);
  const { data: lessons, isLoading: lessonsLoading } = useLessons(chapterId);
  const deleteMutation = useDeleteLesson();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<TrainingLesson | null>(null);

  const openCreate = () => {
    setEditingLesson(null);
    setModalOpen(true);
  };

  const openEdit = (lesson: TrainingLesson) => {
    setEditingLesson(lesson);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingLesson(null);
  };

  const isLoading = chapterLoading || lessonsLoading;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/training"
          className="text-sm text-indigo-600 hover:text-indigo-800 mb-2 inline-block"
        >
          &larr; Back to chapters
        </Link>

        {chapterLoading ? (
          <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
        ) : chapter ? (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{chapter.title}</h1>
              <Badge variant={chapter.is_active ? 'green' : 'gray'}>
                {chapter.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {chapter.description && (
              <p className="text-gray-500">{chapter.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {chapter.categories.map((cat) => (
                <Badge key={cat.id} variant="blue">
                  {cat.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
        <Button onClick={openCreate}>Add Lesson</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : !lessons?.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No lessons yet</p>
            <p className="text-sm mt-1">Add lessons with Loom video links.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Title</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Loom URL</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Sort</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lessons.map((lesson) => (
                <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{lesson.title}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                    <a
                      href={lesson.loom_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      {lesson.loom_url}
                    </a>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={lesson.is_active ? 'green' : 'gray'}>
                      {lesson.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{lesson.sort_order}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(lesson)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Delete this lesson?')) {
                            deleteMutation.mutate({
                              lessonId: lesson.id,
                              chapterId,
                            });
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
        title={editingLesson ? 'Edit Lesson' : 'Add Lesson'}
      >
        <LessonForm
          chapterId={chapterId}
          lesson={editingLesson}
          onClose={closeModal}
        />
      </Modal>
    </div>
  );
}
