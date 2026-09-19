'use client';

import { useState } from 'react';
import CourseList from '@/views/training/CourseList';
import WebinarsManager from '@/views/training/WebinarsManager';

/**
 * Training Program. Courses (synced from SquadHub) share this screen with
 * Webinars (created here for Thailand talents).
 */
export default function TrainingPage() {
  const [tab, setTab] = useState<'courses' | 'webinars'>('courses');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Training Program</h1>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(
            [
              ['courses', 'Courses'],
              ['webinars', 'Webinars'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'courses' ? <CourseList hideHeading /> : <WebinarsManager />}
    </div>
  );
}
