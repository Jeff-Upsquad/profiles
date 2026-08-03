'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { AuthShell } from './LoginTalent';
import { COUNTRY_CODES } from '@/constants/country-codes';

const detectCountryCode = (p: string) =>
  COUNTRY_CODES.find((cc) => p.startsWith(cc.code))?.code ?? '+91';

function SignupBusinessInner() {
  const params = useSearchParams();
  const { businessSignup } = useAuth();

  const prefillEmail = params.get('email') ?? '';
  const prefillPhone = params.get('phone') ?? '';

  const [countryCode, setCountryCode] = useState(() =>
    prefillPhone ? detectCountryCode(prefillPhone) : '+91',
  );
  const [email, setEmail] = useState(prefillEmail);
  // Phone is stored with its country code, e.g. "+919876543210".
  const [phone, setPhone] = useState(() => {
    if (!prefillPhone) return '+91';
    return prefillPhone.startsWith('+')
      ? prefillPhone
      : '+91' + prefillPhone.replace(/\D/g, '');
  });
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const phoneDigits = phone.replace(/\D/g, '');
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (phoneDigits.length < 7) {
      toast.error('Phone number is required');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await businessSignup({
        email: email.trim(),
        phone,
        name,
        company_name: companyName,
        password,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not complete signup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell switchHref="/login/business" switchLabel="Back to Login" accent="business">
      <div className="stagger-1">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--cu-radius)] bg-brand-pink border-2 border-cu-900 shadow-brutal-sm">
          <svg className="h-5 w-5 text-cu-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>

        <h1 className="font-display text-[1.625rem] font-bold text-cu-900">
          Create your account
        </h1>
        <p className="mt-1 font-ui text-sm text-cu-500">
          Sign up to start discovering talent on SquadHire
        </p>
      </div>

      <form onSubmit={handleSubmit} className="stagger-2 mt-7 space-y-4">
        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="input-v5"
          />
        </div>

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Phone number
          </label>
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
              className="input-v5 flex-1"
            />
          </div>
        </div>

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            required
            className="input-v5"
          />
        </div>

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Business name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Studios"
            required
            className="input-v5"
          />
        </div>

        <div>
          <label className="font-ui mb-1.5 block text-[13px] font-medium text-cu-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
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
              Creating account…
            </span>
          ) : (
            <>
              Create account &amp; sign in
              <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        <p className="font-ui text-center text-xs text-cu-500">
          Already set up?{' '}
          <a href="/login/business" className="font-medium text-cu-900 underline underline-offset-4">
            Log in
          </a>
        </p>
      </form>
    </AuthShell>
  );
}

export default function SignupBusiness() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="font-ui text-sm text-cu-500">Loading…</p>
        </div>
      }
    >
      <SignupBusinessInner />
    </Suspense>
  );
}
