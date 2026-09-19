'use client';

import WebinarsManager from '@/views/training/WebinarsManager';

/**
 * Webinars — standalone module (sidebar) for live sessions aimed at Thailand
 * talents. Shares the `training` permission slug, so training staff keep
 * access with no grant changes.
 */
export default function WebinarsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Webinars</h1>
      </div>
      <WebinarsManager hideHeading />
    </div>
  );
}
