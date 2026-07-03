import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCategories';
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
  const [gatesProfileCreation, setGatesProfileCreation] = useState(
    chapter?.gates_profile_creation ?? false,
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    chapter?.categories?.map((c) => c.id) ?? [],
  );

  const effectiveCourseId = courseId ?? chapter?.course_id ?? null;
  const { data: course } = useCourse(effectiveCourseId ?? undefined);
  const { data: categories } = useCategories();
  const createMutation = useCreateChapter();
  const updateMutation = useUpdateChapter();
  const isEditing = !!chapter;
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Standalone chapters (not under a course) get their category links directly.
  // Course chapters inherit categories from the course, so the picker is hidden
  // and no chapter-level category_ids are sent for them.
  const isStandalone = !effectiveCourseId;

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      description: description || undefined,
      sort_order: sortOrder,
      is_active: isActive,
      linked_module: linkedModule || null,
      gates_profile_creation: gatesProfileCreation,
      course_id: effectiveCourseId,
      // Only send when standalone AND at least one is chosen: the backend
      // requires category_ids to be non-empty when present, and course
      // chapters must keep omitting it (they inherit from the course).
      ...(isStandalone && selectedCategoryIds.length > 0
        ? { category_ids: selectedCategoryIds }
        : {}),
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

      {isStandalone && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categories
            <span className="ml-2 text-xs font-normal text-gray-500">
              (which talents this chapter applies to)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {(categories ?? [])
              .filter((c) => c.is_active)
              .map((cat) => {
                const selected = selectedCategoryIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
          </div>
          {linkedModule && selectedCategoryIds.length === 0 && (
            <p className="mt-1 text-sm text-amber-600">
              Select at least one category, or this gate won&apos;t apply to any talent.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <label htmlFor="chapter-gates-profile" className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            id="chapter-gates-profile"
            checked={gatesProfileCreation}
            onChange={(e) => setGatesProfileCreation(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">
            <span className="font-medium">Gate job-profile creation</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              When on, talents must finish this chapter before creating a job profile in the linked
              category. Remember to link this chapter to that category (add it to a course/category, or
              a category-linked chapter) so it also shows in their Training Program.
            </span>
          </span>
        </label>
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
