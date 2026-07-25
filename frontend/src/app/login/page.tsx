'use client';

import Link from 'next/link';

export default function LoginChooseRolePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cu-50">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-[180px] left-1/2 h-[450px] w-[450px] -translate-x-1/2 rounded-full opacity-60 blur-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(212, 255, 77, 0.55) 0%, transparent 70%)' }}
      />
      <div className="pointer-events-none absolute -bottom-[120px] -left-[120px] h-[350px] w-[350px] rounded-full opacity-50 blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(168, 232, 232, 0.55) 0%, transparent 70%)' }}
      />
      <div className="pointer-events-none absolute -bottom-[120px] -right-[120px] h-[350px] w-[350px] rounded-full opacity-50 blur-[100px]"
        style={{ background: 'radial-gradient(circle, rgba(240, 251, 41, 0.5) 0%, transparent 70%)' }}
      />

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-center px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="ring-conic flex h-8 w-8 items-center justify-center rounded-[var(--cu-radius-sm)]">
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[6px] bg-cu-900 text-sm font-bold text-white">
              S
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[15px] font-bold text-cu-900">SquadHire</span>
            <span className="font-ui text-[10px] text-cu-400">Powered by UpSquad</span>
          </div>
        </Link>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex justify-center px-4 pt-10 pb-24 sm:pt-16">
        <div className="w-full max-w-[460px]">
          {/* Title section */}
          <div className="stagger-1 mb-8 text-center">
            <div className="eyebrow-rainbow mx-auto mb-4 w-fit">
              Secure Login
            </div>
            <h1 className="font-display text-[2rem] font-bold text-cu-900 sm:text-[2.25rem]">
              Welcome to SquadHire
            </h1>
            <p className="mt-2 font-ui text-sm text-cu-500">
              Choose how you'd like to sign in today
            </p>
          </div>

          {/* Role cards */}
          <div className="stagger-2 space-y-3">
            <Link
              href="/login/talent"
              className="group card-v5 flex items-center gap-4 p-5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--cu-radius)] bg-brand-purple border-2 border-cu-900 shadow-brutal-sm">
                <svg className="h-5.5 w-5.5 text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-display text-[15px] font-semibold text-cu-900">
                  I'm a Talent
                </div>
                <div className="mt-0.5 font-ui text-xs text-cu-500">
                  Sign in with your email and password
                </div>
              </div>
              <svg className="h-5 w-5 text-cu-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/login/business"
              className="group card-v5 flex items-center gap-4 p-5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--cu-radius)] bg-brand-pink border-2 border-cu-900 shadow-brutal-sm">
                <svg className="h-5.5 w-5.5 text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-display text-[15px] font-semibold text-cu-900">
                  I'm a Business
                </div>
                <div className="mt-0.5 font-ui text-xs text-cu-500">
                  Sign in with your email or phone and password
                </div>
              </div>
              <svg className="h-5 w-5 text-cu-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Footer */}
          <div className="stagger-3 mt-8 text-center font-ui text-xs text-cu-400">
            By signing in, you agree to UpSquad's terms of service
          </div>
        </div>
      </main>
    </div>
  );
}
