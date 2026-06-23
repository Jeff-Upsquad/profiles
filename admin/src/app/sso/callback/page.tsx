'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LOGIN_PATH } from '@/lib/appMode';

/**
 * "Sign in with SquadHub" callback. SquadHub redirected back here with a
 * one-time code; we verify the CSRF state, exchange the code for a staff
 * session (via the public /staff-auth/sso/exchange endpoint), and land in the
 * portal. Uses bare axios so the shared api interceptor doesn't hijack the
 * unauthenticated exchange call's error handling.
 */
export default function SsoCallbackPage() {
  const router = useRouter();
  const { applyStaffSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const expected = sessionStorage.getItem('squadhub_sso_state');
      sessionStorage.removeItem('squadhub_sso_state');

      if (!code || !state) {
        setError('This sign-in link is incomplete. Please start again from the login page.');
        return;
      }
      if (!expected || expected !== state) {
        setError('Sign-in could not be verified. Please start again from the login page.');
        return;
      }

      try {
        const { data } = await axios.post('/api/staff-auth/sso/exchange', { code });
        applyStaffSession(data);
        router.replace('/');
      } catch (e: any) {
        setError(
          e?.response?.data?.error ||
            e?.response?.data?.message ||
            'SquadHub sign-in failed. Please try again.',
        );
      }
    })();
  }, [applyStaffSession, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <a
              href={LOGIN_PATH}
              className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
