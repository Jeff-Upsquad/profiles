import { useAuth } from '@/context/AuthContext';

/** Shown only when ops declined the account. Pending no longer blocks the talent. */
export default function PendingApprovalBanner() {
  const { user } = useAuth();

  if (user?.approval_status !== 'rejected') return null;

  return (
    <div className="flex items-start gap-3 rounded-[14px] border border-red-200 bg-red-50 p-4">
      <svg
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z"
        />
      </svg>
      <div className="text-sm">
        <p className="font-semibold text-red-900">Your account was not approved.</p>
        <p className="mt-0.5 text-red-800">
          You can still edit drafts. Submitting a profile for review is locked until an admin
          revisits your account.
        </p>
      </div>
    </div>
  );
}
