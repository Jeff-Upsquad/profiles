'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { AuthShell } from './LoginTalent';
import { COUNTRY_CODES } from '@/constants/country-codes';

type Identifier = 'email' | 'phone';

export default function LoginBusiness() {
  const router = useRouter();
  const { businessLogin, user, token } = useAuth();

  // Already signed in (e.g. a mobile swipe-back landed here from the app).
  // `token` is read synchronously from localStorage on mount, so it's set
  // before `user` finishes loading — bounce back into the portal immediately
  // instead of flashing (or getting stuck on) the login form. Once `user`
  // resolves we route to the exact portal for their role.
  useEffect(() => {
    if (!token) return;
    // Hard document replace so this login segment is fully torn down. A soft
    // router.replace here can leave the login view mounted above the app on
    // mobile, so the user sees it by scrolling up past the portal.
    window.location.replace(
      !user || user.role === 'business' ? '/business/hire' : '/dashboard',
    );
  }, [token, user]);

  const [identifier, setIdentifier] = useState<Identifier>('email');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  // Phone is stored with its country code, e.g. "+919876543210" — matching the
  // signup form so the value round-trips cleanly to first-time signup.
  const [phone, setPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // A token is present — a still-signed-in user reached this page (e.g. mobile)
  // swipe-back). Render nothing while the effect above redirects, so the login
  // form never flashes.
  if (token) return null;

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
              onChange={(e) => { setEmail(e.target.value); }}
              placeholder="you@company.com"
              required
              autoFocus
              className="input-v5"
            />
          ) : (
            <div className="flex items-stretch gap-2">
              <select
                value={countryCode}
                onChange={(e) => {
                  const newCode = e.target.value;
                  const digits = phone.replace(countryCode, '');
                  setCountryCode(newCode);
                  setPhone(newCode + digits);
                }}
                aria-label="Country code"
                className="input-v5"
                style={{ width: 'auto', flex: '0 0 auto' }}
              >
                {COUNTRY_CODES.map((cc) => (
                  <option key={cc.code} value={cc.code}>
                    {cc.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={phone.replace(countryCode, '')}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                  setPhone(countryCode + digits);
                }}
                placeholder="98765 43210"
                required
                autoFocus
                className="input-v5 flex-1"
              />
            </div>
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
            }}
            placeholder="Enter your password"
            className="input-v5"
          />
          <Link
            href="/forgot-password"
            className="font-ui mt-2 inline-block text-xs font-medium text-cu-500 underline underline-offset-4 hover:text-cu-900"
          >
            Forgot password?
          </Link>
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

        <p className="font-ui text-center text-xs text-cu-500">
          New to SquadHire?{' '}
          <a href="/signup/business" className="font-medium text-cu-900 underline underline-offset-4">
            Create an account
          </a>
        </p>

      </form>


    </AuthShell>
  );
}
