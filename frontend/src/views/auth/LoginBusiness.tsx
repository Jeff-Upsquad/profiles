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
    <AuthShell switchHref="/login/talent" switchLabel="Talent Login" accent="business">
      <div className="stagger-1">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--cu-radius)] bg-brand-pink border-2 border-cu-900 shadow-brutal-sm">
          <svg className="h-5 w-5 text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="font-display text-[1.625rem] font-bold text-cu-900">
          Business Portal
        </h1>
        <p className="mt-1 font-ui text-sm text-cu-500">
          Sign in with your invited {identifier === 'email' ? 'email' : 'phone number'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="stagger-2 mt-7 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
              {identifier === 'email' ? 'Email address' : 'Phone number'}
            </label>
            <button
              type="button"
              onClick={() => {
                setIdentifier(identifier === 'email' ? 'phone' : 'email');
                resetExpiredState();
              }}
              className="font-ui inline-flex items-center gap-1 text-xs font-medium text-cu-900 underline underline-offset-4 hover:opacity-70"
            >
              {identifier === 'email' ? (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Use Phone
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
              placeholder="you@company.com"
              required
              autoFocus
              className="input-v5"
            />
          ) : (
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); resetExpiredState(); }}
              placeholder="+91 98765 43210"
              required
              autoFocus
              className="input-v5"
            />
          )}
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
            <>
              Continue
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        <div className="surface-v5 flex items-center gap-2 px-3 py-2.5">
          <svg className="h-4 w-4 shrink-0 text-cu-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-ui text-xs text-cu-600">
            No password required — business accounts use passwordless login.
          </span>
        </div>
      </form>

      {accessExpired && (
        <div className="stagger-3 mt-5 rounded-[var(--cu-radius)] border border-red-200 bg-red-50 p-4">
          {requestSent ? (
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-cu-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="font-ui text-sm text-green-700">
                Request sent. You'll be contacted once access is restored.
              </p>
            </div>
          ) : (
            <>
              <p className="font-ui mb-3 text-sm text-red-700">
                Your access has expired. Request a renewal below.
              </p>
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={requestLoading}
                className="btn-v5 border border-red-200 bg-white text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
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
