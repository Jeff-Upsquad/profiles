'use client';

import { useEffect, useState } from 'react';
import { formatDuration, useStartCourse, type TrainingCourse } from '@/hooks/useTraining';

interface CourseStartPopupProps {
  course: TrainingCourse;
  onDismiss: () => void;
}

/**
 * Animated start gate for countdown-enabled courses.
 *
 * Animation: backdrop fades in (200ms), card scales up from 95% with a
 * subtle bounce (300ms ease-out). On Start click, the mutation fires and
 * the parent re-renders the course as started — popup unmounts.
 */
export default function CourseStartPopup({ course, onDismiss }: CourseStartPopupProps) {
  const [mounted, setMounted] = useState(false);
  const start = useStartCourse();

  useEffect(() => {
    // Trigger entrance animation after first paint
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleStart = async () => {
    try {
      await start.mutateAsync(course.id);
    } catch {
      // Error toasted by the mutation; keep the popup open
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 transition-opacity duration-200 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(15,15,20,0.55)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.4)]"
        style={{
          transform: mounted ? 'scale(1)' : 'scale(0.92)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
        }}
      >
        {/* Animated rainbow accent at top */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF8B47] via-[#D24DFF] to-[#5BB7FF]" />

        <div className="px-7 pt-7 pb-6">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFEEDB] via-[#F2EEFF] to-[#E5F1FF]">
            <svg
              className="h-9 w-9"
              fill="none"
              viewBox="0 0 24 24"
              stroke="url(#start-grad)"
              strokeWidth={1.75}
            >
              <defs>
                <linearGradient id="start-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FF8B47" />
                  <stop offset="50%" stopColor="#D24DFF" />
                  <stop offset="100%" stopColor="#5BB7FF" />
                </linearGradient>
              </defs>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
          </div>

          <h2 className="text-center font-[family-name:var(--font-jakarta)] text-[22px] font-semibold tracking-[-0.02em] text-[#202020]">
            {course.title}
          </h2>

          <p className="mt-3 text-center text-[15px] leading-relaxed text-[#646464]">
            This course should be completed within{' '}
            <span className="font-semibold text-[#202020]">
              {formatDuration(course.countdown_hours)}
            </span>{' '}
            from clicking the start button.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={handleStart}
              disabled={start.isPending}
              className="btn-iridescent inline-flex w-full justify-center text-sm py-3 px-6 disabled:opacity-50"
            >
              {start.isPending ? 'Starting…' : 'Start course'}
              <svg className="arrow-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            <button
              onClick={onDismiss}
              disabled={start.isPending}
              className="font-[family-name:var(--font-inter)] text-[13px] font-medium text-[#838383] hover:text-[#202020] py-1.5 disabled:opacity-50"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
