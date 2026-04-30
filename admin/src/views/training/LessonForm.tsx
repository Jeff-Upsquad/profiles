import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  useCreateLesson,
  useUpdateLesson,
  type TrainingLesson,
} from '@/hooks/useTraining';

interface LessonFormProps {
  chapterId: string;
  lesson?: TrainingLesson | null;
  onClose: () => void;
}

export default function LessonForm({ chapterId, lesson, onClose }: LessonFormProps) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const [loomUrl, setLoomUrl] = useState(lesson?.loom_url ?? '');
  const [sortOrder, setSortOrder] = useState(lesson?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(lesson?.is_active ?? true);

  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  const isEditing = !!lesson;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      description: description || undefined,
      loom_url: loomUrl,
      sort_order: sortOrder,
      is_active: isActive,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          lessonId: lesson.id,
          chapterId,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync({ chapterId, ...payload });
      }
      onClose();
    } catch {
      // Error handled by mutation onError
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. How to use the dashboard"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Brief description of this lesson"
        />
      </div>

      <Input
        label="Loom URL"
        value={loomUrl}
        onChange={(e) => setLoomUrl(e.target.value)}
        placeholder="https://www.loom.com/share/abc123..."
        helperText="Paste a Loom share URL"
        required
      />

      <Input
        label="Sort Order"
        type="number"
        value={String(sortOrder)}
        onChange={(e) => setSortOrder(Number(e.target.value))}
      />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="lesson-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="lesson-active" className="text-sm text-gray-700">
          Active
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending}>
          {isEditing ? 'Update' : 'Create'} Lesson
        </Button>
      </div>
    </form>
  );
}
