'use client';

import { useState } from 'react';
import { useTalentAccessLogin } from '@/hooks/useTalentAccess';

interface Props {
  onSuccess?: () => void;
}

export default function TalentAccessLogin({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const loginMutation = useTalentAccessLogin();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    try {
      await loginMutation.mutateAsync(email.trim());
      onSuccess?.();
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          'Unable to verify your access. Please contact the administrator.',
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-100">
        <h1 className="text-2xl font-semibold text-zinc-950">
          Talent Profile Access
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Enter the email the administrator added you with. We’ll let you in
          if your access is still active.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginMutation.isPending ? 'Verifying…' : 'Continue'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Trouble signing in? Contact the administrator for a new invite.
        </p>
      </div>
    </div>
  );
}
