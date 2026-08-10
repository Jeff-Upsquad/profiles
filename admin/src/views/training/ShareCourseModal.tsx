'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { useCategories } from '@/hooks/useCategories';
import {
  useCourseShareStats,
  usePreviewShareAudience,
  useShareCourse,
  type TrainingCourse,
} from '@/hooks/useTraining';

interface ShareCourseModalProps {
  course: TrainingCourse;
  onClose: () => void;
}

export default function ShareCourseModal({ course, onClose }: ShareCourseModalProps) {
  const { data: categories = [] } = useCategories();
  const { data: stats } = useCourseShareStats(course.id);
  const previewMutation = usePreviewShareAudience();
  const shareMutation = useShareCourse();

  const [availableToAll, setAvailableToAll] = useState(course.available_to_all ?? false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    course.categories?.map((c) => c.id) ?? [],
  );
  const [notify, setNotify] = useState(true);
  const [reack, setReack] = useState(false);
  const [title, setTitle] = useState(`New training: ${course.title}`);
  const [body, setBody] = useState(
    'Open Training Program, review the content, and mark it complete.',
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [result, setResult] = useState<{
    recipient_count: number;
    notified: number;
    reopened: number;
  } | null>(null);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setPreviewCount(null);
  };

  const audienceValid = availableToAll || selectedCategoryIds.length > 0;

  useEffect(() => {
    if (!audienceValid) {
      setPreviewCount(null);
      return;
    }
    let cancelled = false;
    previewMutation
      .mutateAsync({
        available_to_all: availableToAll,
        category_ids: availableToAll ? [] : selectedCategoryIds,
      })
      .then((res) => {
        if (!cancelled) setPreviewCount(res.count);
      })
      .catch(() => {
        if (!cancelled) setPreviewCount(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableToAll, selectedCategoryIds.join(',')]);

  const handleShare = async () => {
    if (!audienceValid) return;
    try {
      const res = await shareMutation.mutateAsync({
        courseId: course.id,
        available_to_all: availableToAll,
        category_ids: availableToAll ? undefined : selectedCategoryIds,
        notify,
        reack,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      setResult(res);
    } catch {
      // toast handled by mutation
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Shared successfully</p>
          <p className="mt-1">
            {result.recipient_count} talent{result.recipient_count === 1 ? '' : 's'} in audience
            {notify ? ` · ${result.notified} notified` : ''}
            {result.reopened > 0 ? ` · ${result.reopened} reopened` : ''}
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Assign <span className="font-medium text-gray-900">{course.title}</span> to talents by job
        profile. They will see it in Training Program
        {notify ? ' and get an in-app notification' : ''}. Completing the course clears the
        notification and badge.
      </p>

      {stats && stats.assigned > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-center text-xs">
          <div>
            <div className="text-lg font-semibold text-gray-900">{stats.assigned}</div>
            <div className="text-gray-500">Assigned</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-emerald-700">{stats.completed}</div>
            <div className="text-gray-500">Completed</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-700">
              {stats.in_progress + stats.not_started}
            </div>
            <div className="text-gray-500">Outstanding</div>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={availableToAll}
          onChange={(e) => {
            setAvailableToAll(e.target.checked);
            setPreviewCount(null);
          }}
          className="rounded border-gray-300"
        />
        <span className="font-medium text-gray-800">Everyone (all active talents)</span>
      </label>

      {!availableToAll && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Job profiles (categories)
          </label>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
            {categories.length === 0 ? (
              <p className="p-2 text-sm text-gray-500">No categories found.</p>
            ) : (
              categories.map((cat: { id: string; name: string }) => (
                <label
                  key={cat.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    className="rounded border-gray-300"
                  />
                  {cat.name}
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
        {previewMutation.isPending && 'Counting recipients…'}
        {!previewMutation.isPending && previewCount !== null && audienceValid && (
          <>
            Will reach <span className="font-semibold">{previewCount}</span> talent
            {previewCount === 1 ? '' : 's'}
          </>
        )}
        {!audienceValid && 'Select Everyone or at least one job profile.'}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="rounded border-gray-300"
        />
        Send in-app notification
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={reack}
          onChange={(e) => setReack(e.target.checked)}
          className="rounded border-gray-300"
        />
        Require re-ack from talents who already completed (reopen assignment)
      </label>

      {notify && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notification title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notification body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleShare}
          disabled={!audienceValid || shareMutation.isPending || (previewCount === 0)}
        >
          {shareMutation.isPending ? 'Sharing…' : 'Share with talents'}
        </Button>
      </div>
    </div>
  );
}
