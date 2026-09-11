'use client';

import CourseList from '@/views/training/CourseList';

/**
 * Training Program. Courses and Systems & Procedures are both training items
 * synced from SquadHub, so they share one list rather than the two tabs this
 * screen used to carry.
 */
export default function TrainingPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Training Program</h1>
      </div>
      <CourseList hideHeading />
    </div>
  );
}
