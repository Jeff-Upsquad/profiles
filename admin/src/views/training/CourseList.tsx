import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import CourseForm from './CourseForm';
import { useCourses, useArchiveCourse, type TrainingItem } from '@/hooks/useTraining';

export default function CourseList({ hideHeading = false }: { hideHeading?: boolean } = {}) {
  const { data: courses, isLoading } = useCourses();
  const archiveMutation = useArchiveCourse();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingItem | null>(null);

  const openEdit = (course: TrainingItem) => {
    setEditingCourse(course);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCourse(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        {!hideHeading ? (
          <h1 className="text-2xl font-bold text-gray-900">Training Program</h1>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Courses</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Authored in SquadHub Resources. Set what each one unlocks here.
            </p>
          </div>
        )}
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
            <p className="text-sm mt-1">
              Publish a course from SquadHub&rsquo;s Resources module and it appears here.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 font-medium text-gray-500">Title</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Categories</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Deadline</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Pages</th>
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
                  <td className="px-6 py-4 text-gray-500">{course.page_count ?? 0}</td>
                  <td className="px-6 py-4">
                    <Badge variant={course.is_active ? 'green' : 'gray'}>
                      {course.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{course.sort_order}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(course)}>
                        Settings
                      </Button>
                      <Link href={`/training/courses/${course.id}`}>
                        <Button variant="ghost" size="sm">Locks</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Archive this course? Its content stays in SquadHub; the course is hidden from talents until restored.')) {
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


      <Modal isOpen={modalOpen} onClose={closeModal} title="Course settings">
        {editingCourse && <CourseForm course={editingCourse} onClose={closeModal} />}
      </Modal>
    </div>
  );
}
