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
    <ul className="space-y-0">
      {STAGES.map((stage, i) => {
        const done = progress[stage.key];
        const isLast = i === STAGES.length - 1;
        const isBypassed = stage.key === 'onboarding_completed' && progress.onboarding_bypassed === true;
        return (
          <li key={stage.key} className="relative flex gap-3">
            {/* Vertical connector line */}
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-full w-0.5 ${
                  done ? 'bg-green-300' : 'bg-gray-200'
                }`}
              />
            )}
            {/* Circle / check icon */}
            <span className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center">
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
              className={`pb-5 pt-0.5 text-sm font-medium ${
                done ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {stage.label}
              {isBypassed && (
                <span className="ml-2 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                  Bypassed
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
