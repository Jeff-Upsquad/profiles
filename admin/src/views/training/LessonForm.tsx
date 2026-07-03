import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  useCreateLesson,
  useUpdateLesson,
  type LessonVideo,
  type TrainingLesson,
} from '@/hooks/useTraining';

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

interface LessonFormProps {
  chapterId: string;
  lesson?: TrainingLesson | null;
  onClose: () => void;
}

export default function LessonForm({ chapterId, lesson, onClose }: LessonFormProps) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [description, setDescription] = useState(lesson?.description ?? '');
  const initialVideos: LessonVideo[] = lesson?.videos && lesson.videos.length > 0
    ? lesson.videos
    : lesson?.loom_url
      ? [{ language: 'en', loom_url: lesson.loom_url }]
      : [{ language: 'en', loom_url: '' }];
  const [videos, setVideos] = useState<LessonVideo[]>(initialVideos);
  const [sortOrder, setSortOrder] = useState(lesson?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(lesson?.is_active ?? true);

  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  const isEditing = !!lesson;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const usedLanguages = new Set(videos.map((v) => v.language));
  const availableLanguages = LANGUAGE_OPTIONS.filter((l) => !usedLanguages.has(l.value));

  const updateVideo = (index: number, field: keyof LessonVideo, value: string) => {
    setVideos((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const addVideo = () => {
    if (availableLanguages.length === 0) return;
    setVideos((prev) => [...prev, { language: availableLanguages[0].value, loom_url: '' }]);
  };

  const removeVideo = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const hasValidVideos = videos.length > 0 && videos.every((v) => v.language && v.loom_url);
  const hasDuplicateLanguages = new Set(videos.map((v) => v.language)).size !== videos.length;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasValidVideos || hasDuplicateLanguages) return;

    const payload = {
      title,
      description: description || undefined,
      videos,
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Videos by Language <span className="ml-0.5 text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={addVideo}
            disabled={availableLanguages.length === 0}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add language
          </button>
        </div>
        <div className="space-y-2">
          {videos.map((video, index) => (
            <div key={index} className="flex items-start gap-2">
              <select
                value={video.language}
                onChange={(e) => updateVideo(index, 'language', e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-32 flex-shrink-0"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option
                    key={l.value}
                    value={l.value}
                    disabled={usedLanguages.has(l.value) && l.value !== video.language}
                  >
                    {l.label}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={video.loom_url}
                onChange={(e) => updateVideo(index, 'loom_url', e.target.value)}
                placeholder="Loom or SquadClips share URL"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {videos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVideo(index)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
                  aria-label="Remove language"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {hasDuplicateLanguages && (
          <p className="mt-1 text-sm text-red-600">Each language can only appear once</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Add a Loom or SquadClips (clips.squadhub.in) share link for each language you want to support. The talent user picks their language when starting the training.
        </p>
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
        <Button
          type="submit"
          loading={isPending}
          disabled={!hasValidVideos || hasDuplicateLanguages}
        >
          {isEditing ? 'Update' : 'Create'} Lesson
        </Button>
      </div>
    </form>
  );
}
