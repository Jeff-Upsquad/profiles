'use client';

import { useState } from 'react';
import {
  useMyTraining,
  useMarkLessonComplete,
  useMarkLessonIncomplete,
  type TrainingChapter,
  type TrainingLesson,
} from '@/hooks/useTraining';

function loomEmbedUrl(shareUrl: string): string {
  return shareUrl.replace('/share/', '/embed/');
}

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-gray-500 whitespace-nowrap">
        {completed}/{total} completed
      </span>
    </div>
  );
}

function LessonCard({ lesson }: { lesson: TrainingLesson }) {
  const markComplete = useMarkLessonComplete();
  const markIncomplete = useMarkLessonIncomplete();
  const isPending = markComplete.isPending || markIncomplete.isPending;

  const toggle = () => {
    if (lesson.completed) {
      markIncomplete.mutate(lesson.id);
    } else {
      markComplete.mutate(lesson.id);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="aspect-video bg-black">
        <iframe
          src={loomEmbedUrl(lesson.loom_url)}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900">{lesson.title}</h4>
            {lesson.description && (
              <p className="text-sm text-gray-500 mt-1">{lesson.description}</p>
            )}
          </div>
          <button
            onClick={toggle}
            disabled={isPending}
            className={`flex-shrink-0 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              lesson.completed
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } disabled:opacity-50`}
          >
            {lesson.completed ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
            {lesson.completed ? 'Completed' : 'Mark Complete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChapterAccordion({ chapter }: { chapter: TrainingChapter }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{chapter.title}</h3>
          {chapter.description && (
            <p className="text-sm text-gray-500 mt-0.5">{chapter.description}</p>
          )}
          <div className="mt-2 max-w-xs">
            <ProgressBar
              completed={chapter.completed_count}
              total={chapter.total_count}
            />
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-4 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && chapter.lessons.length > 0 && (
        <div className="px-6 pb-6 grid gap-4 sm:grid-cols-2">
          {chapter.lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TrainingProgram() {
  const { data: chapters, isLoading } = useMyTraining();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Training Program</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !chapters?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-medium">No training content available yet</p>
          <p className="text-sm mt-1">Check back later for new chapters and lessons.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter) => (
            <ChapterAccordion key={chapter.id} chapter={chapter} />
          ))}
        </div>
      )}
    </div>
  );
}
