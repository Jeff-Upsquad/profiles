'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  COUNTRIES,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
} from '@/constants/india-locations';
import { COUNTRY_CODES } from '@/constants/country-codes';
import AlreadySubmittedSheet from '@/components/forms/AlreadySubmittedSheet';
import toast from 'react-hot-toast';

const SUPPORT_PHONE_DIGITS = '919995266342';
const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_DIGITS}`;

type ViewState = 'form' | 'success';

interface CandidateSubmission {
  name: string;
  form_type: string;
  status: string;
  submitted_at: string;
}

interface PrefilledLocation {
  country: string | null;
  state: string | null;
  current_district: string | null;
}

interface PrefilledCandidate {
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface CheckResult {
  has_invitation: boolean;
  has_account: boolean;
  submissions: CandidateSubmission[];
  prefilled_location: PrefilledLocation | null;
  prefilled_candidate: PrefilledCandidate | null;
}

export default function SignupTalent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<ViewState>('form');
  const [showExistsSheet, setShowExistsSheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const prefilledRef = useRef(false);

  const [countryCode, setCountryCode] = useState('+91');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '+91',
    country: 'India',
    state: '',
    current_district: '',
  });

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  // Debounced inline status check whenever email or phone changes.
  useEffect(() => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    const phoneDigits = form.phone.replace(countryCode, '').replace(/\D/g, '');
    const phoneValid = phoneDigits.length >= 10;

    if (!emailValid && !phoneValid) {
      setCheckResult(null);
      setCheckLoading(false);
      return;
    }

    setCheckLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { data } = await api.post('/auth/check-candidate-status', {
          email: emailValid ? form.email.trim() : undefined,
          phone: phoneValid ? form.phone.trim() : undefined,
        });
        setCheckResult(data);

        if (
          !prefilledRef.current &&
          data.has_invitation &&
          !data.has_account
        ) {
          const loc: PrefilledLocation | null = data.prefilled_location;
          const cand: PrefilledCandidate | null = data.prefilled_candidate;

          if (cand?.phone) {
            const matched = COUNTRY_CODES.find((cc) => cand.phone!.startsWith(cc.code));
            if (matched) setCountryCode(matched.code);
          }

          setForm((prev) => {
            const stillDefault =
              prev.country === 'India' && prev.state === '' && prev.current_district === '';
            let phone = cand?.phone || prev.phone;
            if (phone && !phone.startsWith('+')) {
              phone = countryCode + phone;
            }
            return {
              ...prev,
              country: loc?.country || prev.country,
              state: loc?.state || prev.state,
              current_district: loc?.current_district || prev.current_district,
              full_name: cand?.name || prev.full_name,
              phone,
            };
          });
          prefilledRef.current = true;
        }
      } catch {
        setCheckResult(null);
      } finally {
        setCheckLoading(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [form.email, form.phone]);

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm((prev) => ({
      ...prev,
      country: e.target.value,
      state: '',
      current_district: '',
    }));
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({
      ...prev,
      state: e.target.value,
      current_district: '',
    }));
  };

  const canProceed = checkResult?.has_account !== true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    if (!form.email.trim()) { toast.error('Email is required'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirm_password) { toast.error('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      await api.post('/auth/signup/talent', {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        country: form.country || undefined,
        state: form.state || undefined,
        current_district: form.current_district || undefined,
      });
      setView('success');
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 409) {
        setShowExistsSheet(true);
      } else {
        toast.error(err.response?.data?.message || 'Signup failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F6] via-white to-[#F5F5F6]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-[#F5F5F6] via-white to-[#F5F5F6] px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0a] text-lg font-bold text-white">
              S
            </div>
            <span className="text-2xl font-bold text-gray-900">UpSquad</span>
          </Link>
        </div>

        <Card className="p-6 sm:p-8">
          {/* ── Success State ── */}
          {view === 'success' && (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Account Created!</h2>
              <p className="mt-2 text-sm text-gray-500">
                Your account has been created successfully. Redirecting you to the login page...
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[#0a0a0a] hover:text-[#0a0a0a]"
              >
                Sign In Now
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          )}

          {/* ── Signup Form ── */}
          {view === 'form' && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Showcase your skills and get discovered by businesses
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email + Phone — account-exists check fires as they type. */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="you@example.com"
                    required
                  />
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">
                      Phone
                    </label>
                    <div className="flex items-stretch gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          const digits = form.phone.replace(countryCode, '');
                          setCountryCode(newCode);
                          setForm((prev) => ({ ...prev, phone: newCode + digits }));
                        }}
                        className="w-[110px] shrink-0 rounded-lg border border-[#E7E7EA] bg-white px-2 text-sm font-medium text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      >
                        {COUNTRY_CODES.map((cc) => (
                          <option key={cc.code} value={cc.code}>{cc.label}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={15}
                        value={form.phone.replace(countryCode, '')}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                          setForm((prev) => ({ ...prev, phone: countryCode + digits }));
                        }}
                        placeholder="Phone number"
                        className="block w-full rounded-lg border border-[#E7E7EA] px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12 bg-white text-[#0a0a0a]"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Inline status check ── */}
                {(checkLoading || checkResult) && (
                  <div className="pt-1">
                    {checkLoading && (
                      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                        Checking your status...
                      </div>
                    )}
                    {!checkLoading && checkResult?.has_account && (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">An account already exists</p>
                          <p className="mt-0.5 text-sm text-amber-800">
                            You can{' '}
                            <Link href="/login" className="font-semibold underline hover:text-amber-900">
                              sign in instead
                            </Link>
                            , or contact{' '}
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-amber-900">
                              WhatsApp Talent Support
                            </a>
                            .
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Remaining fields — open signup; disabled only if an account already exists. */}
                <fieldset
                  disabled={!canProceed}
                  className={`space-y-4 ${canProceed ? '' : 'opacity-50 pointer-events-none select-none'}`}
                  aria-hidden={!canProceed}
                >
                  <Input
                    label="Full Name"
                    value={form.full_name}
                    onChange={set('full_name')}
                    placeholder="Your full name"
                    required
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Password"
                      type="password"
                      value={form.password}
                      onChange={set('password')}
                      placeholder="Minimum 8 characters"
                      required
                    />
                    <Input
                      label="Confirm Password"
                      type="password"
                      value={form.confirm_password}
                      onChange={set('confirm_password')}
                      placeholder="Re-enter password"
                      required
                      error={
                        form.confirm_password && form.password !== form.confirm_password
                          ? 'Passwords do not match'
                          : undefined
                      }
                    />
                  </div>

                  <div className="pt-2">
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">Location</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Select
                        label="Country"
                        value={form.country}
                        onChange={handleCountryChange}
                        options={COUNTRIES}
                      />
                      {form.country === 'India' ? (
                        <Select
                          label="State"
                          value={form.state}
                          onChange={handleStateChange}
                          placeholder="Select state"
                          options={INDIAN_STATES}
                        />
                      ) : (
                        <Input
                          label="State / Region"
                          value={form.state}
                          onChange={handleStateChange as any}
                          placeholder="State or region"
                        />
                      )}
                      {form.country === 'India' && form.state ? (
                        <Select
                          label="District"
                          value={form.current_district}
                          onChange={set('current_district') as any}
                          placeholder="Select district"
                          options={(DISTRICTS_BY_STATE[form.state] || []).map((d) => ({
                            label: d,
                            value: d,
                          }))}
                        />
                      ) : (
                        <Input
                          label="District"
                          value={form.current_district}
                          onChange={set('current_district')}
                          placeholder={form.country === 'India' ? 'Select a state first' : 'District'}
                          disabled={form.country === 'India' && !form.state}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-4 border-t border-gray-100">
                    <Button type="submit" loading={submitting} disabled={!canProceed}>
                      Create Account
                    </Button>
                  </div>
                </fieldset>
              </form>

              <div className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-medium text-[#0a0a0a] hover:text-[#0a0a0a]"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-2 text-center text-sm text-gray-500">
                Are you a business?{' '}
                <Link
                  href="/signup/business"
                  className="font-medium text-[#0a0a0a] hover:text-[#0a0a0a]"
                >
                  Sign up as Business
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>

      <AlreadySubmittedSheet
        open={showExistsSheet}
        onClose={() => setShowExistsSheet(false)}
        message="An account with this email or number already exists. Sign in instead, or chat with Talent Support on WhatsApp — we’ll help you out."
        signInHref="/login"
      />
    </div>
  );
}
