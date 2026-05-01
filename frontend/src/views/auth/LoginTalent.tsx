'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginTalent() {
  const { login } = useAuth();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;
    setStep('password');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      switchHref="/login/business"
      switchLabel="Business Login"
      accent="talent"
    >
      <div className="stagger-1">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--cu-radius)] bg-iris-50">
          <svg className="h-5 w-5 text-iris-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h1 className="font-display text-[1.625rem] font-bold text-cu-900">
          Welcome back
        </h1>
        <p className="mt-1 font-ui text-sm text-cu-500">
          Sign in to your talent account
        </p>
      </div>

      {step === 'email' ? (
        <form onSubmit={handleContinue} className="stagger-2 mt-7 space-y-4">
          <div>
            <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleContinue();
                }
              }}
              placeholder="you@email.com"
              required
              autoFocus
              className="input-v5"
            />
          </div>
          <button type="submit" className="btn-v5 btn-v5-primary btn-v5-lg w-full">
            Continue
            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="stagger-2 mt-7 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
                Email
              </label>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="font-ui text-xs font-medium text-iris-500 hover:text-iris-600"
              >
                Change
              </button>
            </div>
            <input
              type="email"
              value={email}
              disabled
              className="input-v5"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="font-ui text-xs font-medium text-iris-500 hover:text-iris-600"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
              className="input-v5"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-v5 btn-v5-primary btn-v5-lg w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      )}

      <div className="stagger-3 mt-6 border-t border-cu-200 pt-4 text-center font-ui text-xs text-cu-500">
        Have an invitation?{' '}
        <Link href="/signup/talent" className="font-medium text-iris-500 hover:text-iris-600">
          Sign up as Talent
        </Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({
  children,
  switchHref,
  switchLabel,
  accent = 'talent',
}: {
  children: React.ReactNode;
  switchHref: string;
  switchLabel: string;
  accent?: 'talent' | 'business';
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cu-50">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-[200px] -right-[200px] h-[500px] w-[500px] rounded-full opacity-40 blur-[120px]"
        style={{
          background: accent === 'talent'
            ? 'radial-gradient(circle, rgba(102, 71, 240, 0.25) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0, 145, 255, 0.2) 0%, transparent 70%)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-[150px] -left-[150px] h-[400px] w-[400px] rounded-full opacity-30 blur-[100px]"
        style={{
          background: accent === 'talent'
            ? 'radial-gradient(circle, rgba(255, 91, 139, 0.2) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(23, 207, 207, 0.18) 0%, transparent 70%)',
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
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
        <Link
          href={switchHref}
          className="btn-v5 btn-v5-secondary text-xs"
        >
          {switchLabel}
        </Link>
      </header>

      {/* Card */}
      <main className="relative z-10 flex justify-center px-4 pt-10 pb-24 sm:pt-16">
        <div className="card-v5-elevated w-full max-w-[420px] p-8 sm:p-10">
          {children}
        </div>
      </main>
    </div>
  );
}
