type Phase = 'loading' | 'approved';

interface ApprovalCelebrationProps {
  phase: Phase;
}

export default function ApprovalCelebration({ phase }: ApprovalCelebrationProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white/95 backdrop-blur-sm">
      {phase === 'loading' ? (
        <>
          <svg
            className="h-12 w-12 animate-spin text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-20"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-90"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">Submitting your profile…</p>
            <p className="mt-1 text-sm text-gray-500">Hang tight, this only takes a moment.</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50 transition-transform duration-300 ease-out">
            <svg
              className="h-10 w-10 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">Approved!</p>
            <p className="mt-1 text-sm text-gray-500">
              Your account is live — redirecting to your profile…
            </p>
          </div>
        </>
      )}
    </div>
  );
}
