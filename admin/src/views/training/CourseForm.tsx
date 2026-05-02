import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateCourse,
  useUpdateCourse,
  type TrainingCourse,
} from '@/hooks/useTraining';

interface CourseFormProps {
  course?: TrainingCourse | null;
  onClose: () => void;
}

export default function CourseForm({ course, onClose }: CourseFormProps) {
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [sortOrder, setSortOrder] = useState(course?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(course?.is_active ?? true);
  const [isOnboarding, setIsOnboarding] = useState(course?.is_onboarding ?? false);
  const [availableToAll, setAvailableToAll] = useState(course?.available_to_all ?? false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    course?.categories?.map((c) => c.id) ?? [],
  );

  const { data: categories } = useCategories();
  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();
  const isEditing = !!course;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const requiresCategories = isOnboarding;
  const categoryError = requiresCategories && selectedCategoryIds.length === 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (categoryError) return;

    const payload = {
      title,
      description: description || undefined,
      sort_order: sortOrder,
      is_active: isActive,
      is_onboarding: isOnboarding,
      available_to_all: availableToAll,
      category_ids: selectedCategoryIds,
    };

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: course.id, ...payload });
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
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Designer Onboarding"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Brief description of this course"
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
          id="course-active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="course-active" className="text-sm text-gray-700">Active</label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="course-onboarding"
          checked={isOnboarding}
          onChange={(e) => setIsOnboarding(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="course-onboarding" className="text-sm text-gray-700">
          Onboarding course
        </label>
      </div>
      {isOnboarding && (
        <p className="text-xs text-amber-700 -mt-2">
          Onboarding courses enforce sequential chapter unlocking and are required for new talents in the selected categories. Each category may belong to only one onboarding course.
        </p>
      )}

      {isOnboarding && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="course-available-to-all"
            checked={availableToAll}
            onChange={(e) => setAvailableToAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="course-available-to-all" className="text-sm text-gray-700">
            Available to all users
          </label>
        </div>
      )}
      {isOnboarding && availableToAll && (
        <p className="text-xs text-amber-700 -mt-2">
          This course will be visible to all users, including existing approved talents who may not match the selected categories. Chapters will remain unlocked for approved users.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categories {requiresCategories && <span className="ml-0.5 text-red-500">*</span>}
          {!requiresCategories && <span className="ml-2 text-xs font-normal text-gray-500">(optional &mdash; leave empty to make visible to all talents)</span>}
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
        {categoryError && (
          <p className="mt-1 text-sm text-red-600">Onboarding courses require at least one category</p>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={isPending} disabled={categoryError}>
          {isEditing ? 'Update' : 'Create'} Course
        </Button>
      </div>
    </form>
  );
}
