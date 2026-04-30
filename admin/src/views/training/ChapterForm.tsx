import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateChapter,
  useUpdateChapter,
  type TrainingChapter,
} from '@/hooks/useTraining';

interface ChapterFormProps {
  chapter?: TrainingChapter | null;
  onClose: () => void;
}

export default function ChapterForm({ chapter, onClose }: ChapterFormProps) {
  const [title, setTitle] = useState(chapter?.title ?? '');
  const [description, setDescription] = useState(chapter?.description ?? '');
  const [sortOrder, setSortOrder] = useState(chapter?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(chapter?.is_active ?? true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    chapter?.categories?.map((c) => c.id) ?? [],
  );

  const { data: categories } = useCategories();
  const createMutation = useCreateChapter();
  const updateMutation = useUpdateChapter();
  const isEditing = !!chapter;
  const isPending = createMutation.isPending || updateMutation.isPending;

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
      category_ids: selectedCategoryIds,
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
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Getting Started"
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
          placeholder="Brief description of this chapter"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Categories <span className="ml-0.5 text-red-500">*</span>
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
        {selectedCategoryIds.length === 0 && (
          <p className="mt-1 text-sm text-red-600">Select at least one category</p>
        )}
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
        <label htmlFor="chapter-active" className="text-sm text-gray-700">
          Active
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={isPending}
          disabled={selectedCategoryIds.length === 0}
        >
          {isEditing ? 'Update' : 'Create'} Chapter
        </Button>
      </div>
    </form>
  );
}
