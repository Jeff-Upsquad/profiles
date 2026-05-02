import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import CourseForm from './CourseForm';
import {
  useCourses,
  useArchiveCourse,
  useChapters,
  type TrainingCourse,
} from '@/hooks/useTraining';

export default function CourseList() {
  const { data: courses, isLoading } = useCourses();
  const { data: unassignedChapters } = useChapters(null);
  const archiveMutation = useArchiveCourse();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);

  const openCreate = () => {
    setEditingCourse(null);
    setModalOpen(true);
  };

  const openEdit = (course: TrainingCourse) => {
    setEditingCourse(course);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCourse(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Training Program</h1>
        <Button onClick={openCreate}>Create Course</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : !courses?.length ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">No courses yet</p>
            <p className="text-sm mt-1">Create your first course to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Title</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Categories</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Deadline</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Chapters</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Sort</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    <Link
                      href={`/training/courses/${course.id}`}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      {course.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    {course.is_onboarding ? (
                      <Badge variant="indigo">Onboarding</Badge>
                    ) : (
                      <span className="text-gray-400 text-xs">Standard</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {course.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {course.categories.map((cat) => (
                          <Badge key={cat.id} variant="blue">
                            {cat.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">All</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {course.countdown_enabled && course.countdown_hours
                      ? <Badge variant="indigo">{course.countdown_hours % 24 === 0 ? `${course.countdown_hours / 24}d` : `${course.countdown_hours}h`}</Badge>
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{course.chapter_count ?? 0}</td>
                  <td className="px-6 py-4">
                    <Badge variant={course.is_active ? 'green' : 'gray'}>
                      {course.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{course.sort_order}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(course)}>
                        Edit
                      </Button>
                      <Link href={`/training/courses/${course.id}`}>
                        <Button variant="ghost" size="sm">Chapters</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Archive this course? Its chapters and lessons remain but the course is hidden until restored.')) {
                            archiveMutation.mutate(course.id);
                          }
                        }}
                        disabled={archiveMutation.isPending}
                      >
                        Archive
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {unassignedChapters && unassignedChapters.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-200">
            <h2 className="text-base font-semibold text-amber-900">Unassigned chapters</h2>
            <p className="text-xs text-amber-800 mt-1">
              These chapters aren't part of any course yet. Open each chapter and assign it to a course.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-200 bg-amber-100">
                <th className="text-left px-6 py-3 font-medium text-amber-900">Title</th>
                <th className="text-left px-6 py-3 font-medium text-amber-900">Lessons</th>
                <th className="text-right px-6 py-3 font-medium text-amber-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200">
              {unassignedChapters.map((ch) => (
                <tr key={ch.id} className="hover:bg-amber-100/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{ch.title}</td>
                  <td className="px-6 py-4 text-gray-500">{ch.lesson_count}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/training/${ch.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingCourse ? 'Edit Course' : 'Create Course'}
      >
        <CourseForm course={editingCourse} onClose={closeModal} />
      </Modal>
    </div>
  );
}
