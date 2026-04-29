'use client';

import { useEffect, useState } from 'react';

interface ApprovalResult {
  approved: boolean;
  redirect_url?: string;
  message?: string;
}

const STAGES = [
  { label: 'Submitting your application', detail: 'Saving your details securely' },
  { label: 'Verifying contact information', detail: 'Checking phone and email' },
  { label: 'Reviewing your profile', detail: 'Matching against partner criteria' },
  { label: 'Finalizing your approval', detail: 'Almost there…' },
];

const TOTAL_DURATION_MS = 10000;
const STAGE_DURATION_MS = TOTAL_DURATION_MS / STAGES.length;

function CheckingScreen() {
  const [stageIdx, setStageIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, STAGE_DURATION_MS);

    const tickInterval = setInterval(() => {
      setElapsed((e) => Math.min(e + 50, TOTAL_DURATION_MS));
    }, 50);

    return () => {
      clearInterval(stageInterval);
      clearInterval(tickInterval);
    };
  }, []);

  const progressPct = Math.min((elapsed / TOTAL_DURATION_MS) * 100, 100);
  const stage = STAGES[stageIdx];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F7F6F3] via-[#EEF2FF] to-[#F7F6F3] px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-black/5">
        {/* Animated logo */}
        <div className="relative mx-auto mb-8 h-24 w-24">
          {/* Outer pulsing ring */}
          <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400 opacity-20" />
          {/* Middle rotating gradient ring */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 [animation:spin_3s_linear_infinite]" />
          {/* Inner white circle */}
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
            {/* Animated checkmark/sparkle */}
            <svg
              className="h-10 w-10 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Checking your approval
        </h2>

        {/* Stage label — fades through messages */}
        <div className="relative mt-3 h-12 overflow-hidden">
          <div
            key={stageIdx}
            className="animate-[fadeIn_0.4s_ease-out]"
          >
            <p className="text-sm font-medium text-indigo-600">{stage.label}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{stage.detail}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Stage dots */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < stageIdx
                  ? 'w-4 bg-indigo-500'
                  : i === stageIdx
                  ? 'w-8 bg-indigo-500 animate-pulse'
                  : 'w-1.5 bg-neutral-200'
              }`}
            />
          ))}
        </div>

        {/* Subtle helper text */}
        <p className="mt-6 text-xs text-neutral-400">
          This usually takes about 10 seconds
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default function SubmissionResultScreen({
  checking,
  result,
}: {
  checking: boolean;
  result: ApprovalResult | null;
}) {
  if (checking) {
    return <CheckingScreen />;
  }

  if (result?.approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F7F6F3] via-[#ECFDF5] to-[#F7F6F3] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-black/5 animate-[scaleIn_0.5s_ease-out]">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/30">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {result.message || 'Your profile is auto-approved!'}
          </h2>
          <p className="mt-3 text-neutral-500">
            Congratulations! You have been approved to join the UpSquad Partner
            Program.
          </p>
          {result.redirect_url && (
            <a
              href={result.redirect_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              Visit UpSquad Partner Program
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>

        <style jsx>{`
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

  // Default: standard thank-you screen
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-neutral-900">Thank You!</h2>
        <p className="mt-2 text-neutral-500">
          Your application has been submitted successfully. We&apos;ll review
          your profile and get back to you soon.
        </p>
      </div>
    </div>
  );
}
