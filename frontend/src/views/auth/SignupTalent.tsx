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
import toast from 'react-hot-toast';

const SUPPORT_PHONE_DIGITS = '919995266342';
const SUPPORT_PHONE_DISPLAY = '+91 99952 66342';
const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_DIGITS}`;

type ViewState = 'form' | 'success' | 'not_invited' | 'already_exists';

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

const STATUS_LABELS: Record<string, string> = {
  new: 'Application received — under review',
  contacted: 'Our team has reached out to you — please check your messages',
  converted: 'Application processed',
  rejected: 'Application was not selected at this time',
};

const FORM_TYPE_LABELS: Record<string, string> = {
  creative: 'Creative',
  accountant: 'Accountant',
};

export default function SignupTalent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<ViewState>('form');
  const [submitting, setSubmitting] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateSubmissions, setCandidateSubmissions] = useState<CandidateSubmission[]>([]);
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

  const checkCandidateStatus = async () => {
    setCandidateLoading(true);
    try {
      const { data } = await api.post('/auth/check-candidate-status', {
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      setCandidateSubmissions(data.submissions || []);
    } catch {
      setCandidateSubmissions([]);
    } finally {
      setCandidateLoading(false);
    }
  };

  const canProceed =
    !checkLoading && checkResult?.has_invitation === true && checkResult?.has_account === false;

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
      if (status === 403) {
        setView('not_invited');
        checkCandidateStatus();
      } else if (status === 409) {
        setView('already_exists');
      } else {
        toast.error(err.response?.data?.message || 'Signup failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
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
                className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                Sign In Now
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          )}

          {/* ── Not Invited State ── */}
          {view === 'not_invited' && (
            <div className="py-4">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">You Haven't Been Invited Yet</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    We couldn't find a pending invitation for <span className="font-medium text-gray-700">{form.email}</span>.
                  </p>
                </div>
              </div>

              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Did you use the same email address that was used in your application form? Invitations are sent to the email you submitted with.
                </p>
              </div>

              {candidateLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
                  <span className="ml-2 text-sm text-gray-500">Checking your application status...</span>
                </div>
              ) : candidateSubmissions.length > 0 ? (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-gray-800">We found your application</h3>
                  <div className="space-y-3">
                    {candidateSubmissions.map((s, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{s.name}</span>
                          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                            {FORM_TYPE_LABELS[s.form_type] || s.form_type}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm text-gray-600">
                          {STATUS_LABELS[s.status] || s.status}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Submitted {new Date(s.submitted_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    Once your application is reviewed and approved, you will receive an invitation to sign up.
                  </p>
                </div>
              ) : (
                <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <p className="text-sm text-gray-600">
                    We couldn't find an application with this email or phone number.
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    If you haven't applied yet, please reach out to us on WhatsApp to get started.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
                <Button variant="outline" onClick={() => setView('form')}>
                  Back to Form
                </Button>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp Talent Support
                </a>
              </div>
            </div>
          )}

          {/* ── Already Exists State ── */}
          {view === 'already_exists' && (
            <div className="py-4">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Account Already Exists</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    An account with <span className="font-medium text-gray-700">{form.email}</span> already exists.
                  </p>
                </div>
              </div>

              <div className="mb-6 space-y-4">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
                >
                  Sign In Instead
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">
                    Need help accessing your account? Contact Talent Support on WhatsApp.
                  </p>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-green-700 hover:text-green-800"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp: {SUPPORT_PHONE_DISPLAY}
                  </a>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <Button variant="outline" onClick={() => setView('form')}>
                  Back to Form
                </Button>
              </div>
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

              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Signup is by invitation only. Use the email address your invitation was sent to.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Step 1: Email + Phone — always enabled. The check fires here. */}
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
                        className="w-[110px] shrink-0 rounded-lg border border-[#E8E5DE] bg-white px-2 text-sm font-medium text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
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
                        className="block w-full rounded-lg border border-[#E8E5DE] px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12 bg-white text-[#0a0a0a]"
                      />
                    </div>
                  </div>
                </div>

                {/* Initial prompt before any check has run */}
                {!checkLoading && !checkResult && (
                  <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Enter your email or phone to continue</p>
                      <p className="mt-0.5 text-sm text-gray-500">
                        We'll check whether you've been invited before showing the rest of the form.
                      </p>
                    </div>
                  </div>
                )}

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
                    {!checkLoading && !checkResult?.has_account && checkResult?.has_invitation && (
                      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-green-900">You're invited!</p>
                          <p className="mt-0.5 text-sm text-green-800">
                            Complete the form below to create your account.
                          </p>
                        </div>
                      </div>
                    )}
                    {!checkLoading && !checkResult?.has_account && !checkResult?.has_invitation && checkResult && checkResult.submissions.length > 0 && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                        <div className="flex items-start gap-3">
                          <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900">We found your application</p>
                            <p className="mt-0.5 text-sm text-blue-800">
                              You'll receive an invitation to sign up once your application is approved.
                            </p>
                            <div className="mt-2 space-y-1.5">
                              {checkResult.submissions.map((s, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-medium text-blue-900">{s.name}</span>
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                                    {FORM_TYPE_LABELS[s.form_type] || s.form_type}
                                  </span>
                                  <span className="text-blue-700">{STATUS_LABELS[s.status] || s.status}</span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-blue-700">
                              Need help?{' '}
                              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-blue-900">
                                Contact WhatsApp Talent Support
                              </a>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {!checkLoading && !checkResult?.has_account && !checkResult?.has_invitation && checkResult && checkResult.submissions.length === 0 && (
                      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-900">No invitation yet</p>
                          <p className="mt-0.5 text-sm text-amber-800">
                            We couldn't find an invitation or application for this email/phone. Make sure you used the same details from your application form, or{' '}
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-amber-900">
                              contact WhatsApp Talent Support
                            </a>
                            .
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: gated fields — disabled until check confirms a valid invitation. */}
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
                  className="font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-2 text-center text-sm text-gray-500">
                Are you a business?{' '}
                <Link
                  href="/signup/business"
                  className="font-medium text-indigo-600 hover:text-indigo-800"
                >
                  Sign up as Business
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
