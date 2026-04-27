'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { AuthShell } from './LoginTalent';

type Identifier = 'email' | 'phone';

export default function LoginBusiness() {
  const { businessLogin } = useAuth();
  const [identifier, setIdentifier] = useState<Identifier>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [accessExpired, setAccessExpired] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  const resetExpiredState = () => {
    setAccessExpired(false);
    setRequestSent(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await businessLogin(identifier === 'email' ? { email } : { phone });
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessExpired(true);
      } else {
        toast.error(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    setRequestLoading(true);
    try {
      await api.post(
        '/auth/request-access',
        identifier === 'email' ? { email } : { phone }
      );
      setRequestSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <AuthShell switchHref="/login/talent" switchLabel="Talent Login">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">Welcome to SquadHire</h1>
      <p className="mt-0.5 text-xs text-gray-400">Powered by UpSquad</p>
      <p className="mt-1 text-sm text-gray-500">
        Sign in with the {identifier === 'email' ? 'email' : 'phone number'} you were invited with.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-800">
              {identifier === 'email' ? 'Email' : 'Phone'}
            </label>
            <button
              type="button"
              onClick={() => {
                setIdentifier(identifier === 'email' ? 'phone' : 'email');
                resetExpiredState();
              }}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
            >
              {identifier === 'email' ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Use Phone Number
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Use Email
                </>
              )}
            </button>
          </div>
          {identifier === 'email' ? (
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); resetExpiredState(); }}
              placeholder="you@email.com"
              required
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
          ) : (
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); resetExpiredState(); }}
              placeholder="+91 98765 43210"
              required
              autoFocus
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : `Continue with ${identifier === 'email' ? 'Email' : 'Phone'}`}
        </button>

        <p className="text-xs text-gray-500">
          No password required. Business users log in with the credentials they were invited with.
        </p>
      </form>

      {accessExpired && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
          {requestSent ? (
            <p className="text-sm text-green-700">
              Your request has been sent to the administrator. You'll be contacted once access is restored.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-red-700">
                Your access has expired. You can request a renewal below.
              </p>
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={requestLoading}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {requestLoading ? 'Sending…' : 'Request Access'}
              </button>
            </>
          )}
        </div>
      )}
    </AuthShell>
  );
}
