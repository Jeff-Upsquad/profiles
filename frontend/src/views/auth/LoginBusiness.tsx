'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { businessWhatsappDeepLink, BUSINESS_SUPPORT_PHONE_DISPLAY } from '@/lib/whatsapp';
import { AuthShell } from './LoginTalent';

type Identifier = 'email' | 'phone';

export default function LoginBusiness() {
  const router = useRouter();
  const { businessLogin } = useAuth();
  const [identifier, setIdentifier] = useState<Identifier>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showForgot, setShowForgot] = useState(false);
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
      const creds =
        identifier === 'email' ? { email, password } : { phone, password };
      const res = await businessLogin(creds);
      if (res.needsSignup) {
        // First-time user — send them to set their name/business/password.
        const q =
          identifier === 'email'
            ? `email=${encodeURIComponent(email)}`
            : `phone=${encodeURIComponent(phone)}`;
        router.push(`/signup/business?${q}`);
      }
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
          Sign in with your {identifier === 'email' ? 'email' : 'phone number'} and password
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

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              resetExpiredState();
            }}
            placeholder="Enter your password"
            className="input-v5"
          />
          <button
            type="button"
            onClick={() => setShowForgot((v) => !v)}
            className="font-ui mt-2 text-xs font-medium text-cu-500 underline underline-offset-4 hover:text-cu-900"
          >
            Forgot password?
          </button>
        </div>

        {showForgot && (
          <div className="surface-v5 space-y-2.5 px-3 py-3">
            <p className="font-ui text-xs text-cu-600">
              Message us on WhatsApp and our team will reset your password. You&apos;ll
              set a new one the next time you log in.
            </p>
            <a
              href={businessWhatsappDeepLink(
                'Hi, I need help resetting my SquadHire business account password.',
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-v5 btn-v5-primary inline-flex items-center gap-2 text-xs"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              WhatsApp {BUSINESS_SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
        )}

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

        <p className="font-ui text-center text-xs text-cu-500">
          New to SquadHire?{' '}
          <a href="/signup/business" className="font-medium text-cu-900 underline underline-offset-4">
            Create an account
          </a>
        </p>

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
