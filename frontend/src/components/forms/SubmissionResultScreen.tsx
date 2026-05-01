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
    <div className="flex min-h-screen items-center justify-center bg-canvas-100 px-4">
      <div className="card-saas w-full max-w-md p-10 text-center">
        {/* Iridescent orb */}
        <div className="relative mx-auto mb-8 h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-prism opacity-20" />
          <div className="bg-prism absolute inset-1 rounded-full [animation:spin_4s_linear_infinite]" />
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
            <svg
              className="h-10 w-10 text-iris-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
        </div>

        <h2 className="font-display-saas text-2xl font-bold tracking-tight text-canvas-900">
          Reviewing your <span className="text-prism">application</span>
        </h2>

        <div className="relative mt-4 h-12 overflow-hidden">
          <div key={stageIdx} className="animate-[fadeIn_0.4s_ease-out]">
            <p className="text-sm font-medium text-canvas-900">{stage.label}</p>
            <p className="mt-0.5 text-xs text-canvas-500">{stage.detail}</p>
          </div>
        </div>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-canvas-200">
          <div
            className="bg-prism h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i < stageIdx
                  ? 'w-4 bg-canvas-900'
                  : i === stageIdx
                  ? 'w-8 bg-canvas-900 animate-pulse'
                  : 'w-1.5 bg-canvas-200'
              }`}
            />
          ))}
        </div>

        <p className="mt-6 text-xs text-canvas-400">~10 seconds</p>
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
      <div className="flex min-h-screen items-center justify-center bg-canvas-100 px-4">
        <div className="card-saas w-full max-w-md p-10 text-center animate-[scaleIn_0.5s_ease-out]">
          <span className="pill-live mb-6">You&rsquo;re in</span>

          <div className="bg-prism mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-full shadow-[0_8px_24px_-8px_rgba(210,77,255,0.45)]">
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="font-display-saas text-2xl font-bold tracking-tight text-canvas-900">
            {result.message || (
              <>
                Profile <span className="text-prism">approved</span>
              </>
            )}
          </h2>
          <p className="mt-3 text-canvas-600">
            Welcome aboard. You&rsquo;ve been approved to join the UpSquad Partner Program.
          </p>

          {result.redirect_url && (
            <a
              href={result.redirect_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-iridescent mt-7"
            >
              Visit UpSquad Partner Program
              <span className="arrow-icon">→</span>
            </a>
          )}
        </div>

        <style jsx>{`
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas-100 px-4">
      <div className="card-saas w-full max-w-md p-10 text-center">
        <div className="bg-prism mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full shadow-[0_8px_24px_-8px_rgba(210,77,255,0.4)]">
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="font-display-saas text-2xl font-bold tracking-tight text-canvas-900">
          Thank <span className="text-prism">you</span>.
        </h2>
        <p className="mt-3 text-canvas-600">
          Your application has landed. We&rsquo;ll review your profile and get back to you soon.
        </p>
      </div>
    </div>
  );
}
