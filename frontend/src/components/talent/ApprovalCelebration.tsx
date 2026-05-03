type Phase = 'loading' | 'approved';

interface ApprovalCelebrationProps {
  phase: Phase;
}

export default function ApprovalCelebration({ phase }: ApprovalCelebrationProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white/95 backdrop-blur-md">
      {phase === 'loading' ? (
        <>
          <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" />
          <div className="text-center">
            <p className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">Submitting your profile…</p>
            <p className="mt-1 text-sm text-[#737373]">Hang tight, this only takes a moment.</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 ring-8 ring-emerald-50/50 transition-transform duration-300 ease-out">
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
            <p className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">Approved!</p>
            <p className="mt-1 text-sm text-[#737373]">
              Your account is live — redirecting to your profile…
            </p>
          </div>
        </>
      )}
    </div>
  );
}
