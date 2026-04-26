import { useAuth } from '@/context/AuthContext';

export default function PendingApprovalBanner() {
  const { user } = useAuth();
  const autoApprove = user?.auto_approve_signups === true;

  if (autoApprove) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <svg
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <div className="text-sm text-indigo-900">
          <p className="font-semibold">Auto-approval is on.</p>
          <p className="mt-0.5 text-indigo-800">
            Submitting your first profile will activate your account instantly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <svg
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z"
        />
      </svg>
      <div className="text-sm text-amber-900">
        <p className="font-semibold">Your account is pending approval.</p>
        <p className="mt-0.5 text-amber-800">
          You can create draft profiles and add portfolio items now. You&apos;ll be able to submit
          for review once your account is approved.
        </p>
      </div>
    </div>
  );
}
