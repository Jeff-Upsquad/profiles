'use client';

interface ApprovalResult {
  approved: boolean;
  redirect_url?: string;
  message?: string;
}

export default function SubmissionResultScreen({
  checking,
  result,
}: {
  checking: boolean;
  result: ApprovalResult | null;
}) {
  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900">
            Checking your approval
          </h2>
          <p className="mt-2 text-neutral-500">
            Please wait while we review your profile…
          </p>
        </div>
      </div>
    );
  }

  if (result?.approved) {
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
          <h2 className="text-2xl font-semibold text-neutral-900">
            {result.message || 'Your profile is auto-approved!'}
          </h2>
          <p className="mt-2 text-neutral-500">
            Congratulations! You have been approved to join the UpSquad Partner
            Program.
          </p>
          {result.redirect_url && (
            <a
              href={result.redirect_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
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
