import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  useCreateChapter,
  useUpdateChapter,
  useCourse,
  type TrainingChapter,
} from '@/hooks/useTraining';

interface ChapterFormProps {
  chapter?: TrainingChapter | null;
  /** When set, the chapter is created/updated under this course. */
  courseId?: string;
  onClose: () => void;
}

export default function ChapterForm({ chapter, courseId, onClose }: ChapterFormProps) {
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [description, setDescription] = useState(chapter?.description ?? '');
  const [sortOrder, setSortOrder] = useState(chapter?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(chapter?.is_active ?? true);
  const [linkedModule, setLinkedModule] = useState(chapter?.linked_module ?? '');

  const effectiveCourseId = courseId ?? chapter?.course_id ?? null;
  const { data: course } = useCourse(effectiveCourseId ?? undefined);
  const createMutation = useCreateChapter();
  const updateMutation = useUpdateChapter();
  const isEditing = !!chapter;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      description: description || undefined,
      sort_order: sortOrder,
      is_active: isActive,
      linked_module: linkedModule || null,
      course_id: effectiveCourseId,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: chapter.id, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onClose();
    } catch {
      // Error handled by mutation onError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {effectiveCourseId && course && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
          Course: <span className="font-medium">{course.title}</span>
        </div>
      )}

      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Getting Started"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Brief description of this chapter"
        />
      </div>

      <Input
        label="Sort Order"
        type="number"
        value={String(sortOrder)}
        onChange={(e) => setSortOrder(Number(e.target.value))}
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="chapter-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="chapter-active" className="text-sm text-gray-700">Active</label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Linked Module</label>
        <select
          value={linkedModule}
          onChange={(e) => setLinkedModule(e.target.value)}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">None</option>
          <option value="basic-profile">Basic Profile</option>
          <option value="profiles">Job Profiles</option>
          <option value="subscriptions">Subscriptions</option>
          <option value="assignments">Assignments</option>
          <option value="jobs">Job Openings</option>
          <option value="settings">Settings</option>
          <option value="notifications">Notifications</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          The talent sidebar module that will be unlocked when this chapter is completed.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={isPending}>
          {isEditing ? 'Update' : 'Create'} Chapter
        </Button>
      </div>
    </form>
  );
}
