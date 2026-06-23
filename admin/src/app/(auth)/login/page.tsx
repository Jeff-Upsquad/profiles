'use client';

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { IS_STAFF, BASE_PATH } from '@/lib/appMode';

// SquadHub web origin that hosts the SSO authorize bridge (/launch/squadhire).
// Inlined at build time; when unset, the "Sign in with SquadHub" button hides.
const SQUADHUB_WEB = process.env.NEXT_PUBLIC_SQUADHUB_WEB_URL;

function startSquadhubSso() {
  if (!SQUADHUB_WEB) return;
  const state =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Math.random()).slice(2);
  sessionStorage.setItem('squadhub_sso_state', state);
  const redirectUri = `${window.location.origin}${BASE_PATH}/sso/callback`;
  const url = new URL('/launch/squadhire', SQUADHUB_WEB);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  window.location.href = url.toString();
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, login, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Login failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {IS_STAFF ? 'SquadHire Staff' : 'SquadHire Admin'}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Powered by UpSquad</p>
          <p className="text-sm text-gray-500 mt-1">
            {IS_STAFF
              ? 'Sign in to your staff portal'
              : 'Sign in to access the admin panel'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@squadhire.com"
              required
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full"
              size="lg"
            >
              Sign in
            </Button>
          </form>

          {IS_STAFF && SQUADHUB_WEB && (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={startSquadhubSso}
              >
                Sign in with SquadHub
              </Button>
              <p className="mt-2 text-center text-xs text-gray-400">
                Use your SquadHub email and password.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
