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

  const handleContinue = (e: FormEvent) => {
    e.preventDefault();
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
    <AuthShell switchHref="/login/business" switchLabel="Business Login">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">Welcome to SquadHire</h1>
      <p className="mt-1 text-sm text-gray-500">Sign in to your talent account below.</p>

      {step === 'email' ? (
        <form onSubmit={handleContinue} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-800">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Continue with Email
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-800">Email</label>
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                Change
              </button>
            </div>
            <input
              type="email"
              value={email}
              disabled
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-800">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs text-gray-500 hover:text-gray-900"
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
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      )}

      <div className="mt-6 border-t border-gray-100 pt-4 text-center text-xs text-gray-500">
        Have an invitation?{' '}
        <Link href="/signup/talent" className="font-medium text-gray-900 hover:underline">
          Sign up as Talent
        </Link>
      </div>
    </AuthShell>
  );
}

// Shared shell — kept local so both login pages can import it
export function AuthShell({
  children,
  switchHref,
  switchLabel,
}: {
  children: React.ReactNode;
  switchHref: string;
  switchLabel: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-indigo-50">
      {/* Top nav */}
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-sm font-bold text-white">
            S
          </div>
          <span className="text-base font-semibold text-gray-900">SquadHire</span>
        </Link>
        <Link
          href={switchHref}
          className="rounded-full bg-gray-100 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
        >
          {switchLabel}
        </Link>
      </header>

      {/* Card */}
      <main className="flex justify-center px-4 pt-12 pb-24 sm:pt-20">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white/80 p-8 shadow-sm backdrop-blur">
          {children}
        </div>
      </main>
    </div>
  );
}
