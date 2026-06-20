interface OnboardingProgressProps {
  progress: {
    signed_up: boolean;
    onboarding_completed: boolean;
    onboarding_bypassed?: boolean;
    basic_profile_completed: boolean;
    job_profile_completed: boolean;
    portfolio_completed: boolean;
  };
}

const STAGES = [
  { key: 'signed_up', label: 'Sign-up' },
  { key: 'onboarding_completed', label: 'Onboarding Course' },
  { key: 'basic_profile_completed', label: 'Basic Profile' },
  { key: 'job_profile_completed', label: 'Job Profile' },
  { key: 'portfolio_completed', label: 'Portfolio' },
] as const;

export default function OnboardingProgress({ progress }: OnboardingProgressProps) {
  return (
    <ol className="flex items-start">
      {STAGES.map((stage, i) => {
        const done = progress[stage.key];
        const isLast = i === STAGES.length - 1;
        const isBypassed = stage.key === 'onboarding_completed' && progress.onboarding_bypassed === true;
        return (
          <li key={stage.key} className="relative flex flex-1 flex-col items-center px-1 text-center">
            {/* Horizontal connector line to the next step */}
            {!isLast && (
              <span
                className={`absolute left-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${
                  done ? 'bg-green-300' : 'bg-gray-200'
                }`}
              />
            )}
            {/* Circle / check icon (white bg masks the line behind it) */}
            <span className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center bg-white">
              {done ? (
                <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white" />
              )}
            </span>
            {/* Label */}
            <span
              className={`mt-2 text-xs font-medium leading-tight ${
                done ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {stage.label}
            </span>
            {isBypassed && (
              <span className="mt-1 inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                Bypassed
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
