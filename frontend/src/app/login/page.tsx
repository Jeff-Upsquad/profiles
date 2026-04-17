'use client';

import Link from 'next/link';

export default function LoginChooseRolePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-indigo-50">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-sm font-bold text-white">
            S
          </div>
          <span className="text-base font-semibold text-gray-900">SquadHire</span>
        </Link>
      </header>

      <main className="flex justify-center px-4 pt-12 pb-24 sm:pt-20">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white/80 p-8 shadow-sm backdrop-blur">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900">Welcome to SquadHire</h1>
          <p className="mt-1 text-sm text-gray-500">How are you signing in today?</p>

          <div className="mt-6 space-y-3">
            <Link
              href="/login/talent"
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-4 transition-colors hover:border-gray-900 hover:bg-gray-50"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">I'm a Talent</div>
                <div className="text-xs text-gray-500">Sign in with email and password</div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/login/business"
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-4 transition-colors hover:border-gray-900 hover:bg-gray-50"
            >
              <div>
                <div className="text-sm font-semibold text-gray-900">I'm a Business</div>
                <div className="text-xs text-gray-500">Sign in with invited email or phone</div>
              </div>
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
