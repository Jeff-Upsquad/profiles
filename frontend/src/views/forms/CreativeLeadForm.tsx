'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ChipSelect from '@/components/ui/ChipSelect';
import { CREATIVE_ROLES, WORK_TYPE_SEEKING_OPTIONS, GENDER_OPTIONS } from '@/constants/lead-form-options';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';
import { COUNTRY_CODES } from '@/constants/country-codes';
import AlreadySubmittedModal from '@/components/forms/AlreadySubmittedModal';
import SubmissionResultScreen from '@/components/forms/SubmissionResultScreen';
import { useDuplicateContactCheck } from '@/hooks/useDuplicateContactCheck';

interface FormValues {
  name: string;
  phone: string;
  email: string;
  age: string;
  gender: string;
  country: string;
  state: string;
  current_district: string;
  role: string[];
  work_type_seeking: string[];
  experience_years: string;
  portfolio_link: string;
}

const initial: FormValues = {
  name: '',
  phone: '',
  email: '',
  age: '',
  gender: '',
  country: 'India',
  state: '',
  current_district: '',
  role: [],
  work_type_seeking: [],
  experience_years: '',
  portfolio_link: '',
};

const chipStyle = {
  selected:
    'border-canvas-900 bg-canvas-900 text-white shadow-[0_2px_8px_-2px_rgba(24,24,27,0.18)]',
  unselected:
    'border-canvas-200 bg-white text-canvas-700 hover:border-canvas-400 hover:bg-canvas-50',
};

interface SectionProps {
  index: string;
  title: string;
  description?: string;
  delay?: number;
  children: React.ReactNode;
}

function Section({ index, title, description, delay = 0, children }: SectionProps) {
  return (
    <section
      className="section-rise card-saas mt-5 px-6 py-9 sm:mt-6 sm:px-10 sm:py-11"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="grid grid-cols-1 gap-x-12 gap-y-7 lg:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-10 lg:self-start">
          <p className="font-mono-editorial text-[11px] uppercase tracking-[0.16em] text-canvas-400">
            Chapter {index}
          </p>
          <h2 className="font-display-saas mt-3 text-2xl font-bold text-canvas-900 sm:text-[28px]">
            {title}
          </h2>
          {description && (
            <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-canvas-500">
              {description}
            </p>
          )}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </section>
  );
}

export default function CreativeLeadForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initial);
  const [countryCode, setCountryCode] = useState('+91');
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    approved: boolean;
    redirect_url?: string;
    message?: string;
  } | null>(null);
  const [serverError, setServerError] = useState('');
  const [formDisabled, setFormDisabled] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const dup = useDuplicateContactCheck();

  useEffect(() => {
    axios
      .get('/api/leads/form-status/creative')
      .then((res) => {
        if (!res.data.enabled) setFormDisabled(true);
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const set = (key: keyof FormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormValues, string>> = {};

    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.phone.trim()) errs.phone = 'WhatsApp number is required';
    else {
      const digits = form.phone.replace(countryCode, '');
      if (digits.length < 7 || digits.length > 15) errs.phone = 'Enter a valid phone number';
    }
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email';
    if (!form.age.trim()) errs.age = 'Age is required';
    else if (isNaN(Number(form.age)) || Number(form.age) < 16 || Number(form.age) > 100)
      errs.age = 'Enter a valid age (16-100)';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!form.country) errs.country = 'Country is required';
    if (!form.state.trim()) errs.state = 'State is required';
    if (!form.current_district.trim()) errs.current_district = 'District is required';
    if (form.role.length === 0) errs.role = 'Please select at least one role';
    if (form.work_type_seeking.length === 0) errs.work_type_seeking = 'Select at least one option';
    if (!form.experience_years.trim()) errs.experience_years = 'Years of experience is required';
    if (!form.portfolio_link.trim()) errs.portfolio_link = 'Portfolio link is required';
    else {
      try {
        new URL(form.portfolio_link);
      } catch {
        errs.portfolio_link = 'Enter a valid URL';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post('/api/leads/submit', {
        form_type: 'creative',
        name: form.name.trim(),
        phone: form.phone.replace(/\s/g, ''),
        email: form.email.trim(),
        age: Number(form.age),
        gender: form.gender,
        country: form.country,
        state: form.state.trim(),
        current_district: form.current_district.trim(),
        role: form.role,
        work_type_seeking: form.work_type_seeking,
        experience_years: form.experience_years.trim(),
        portfolio_link: form.portfolio_link.trim(),
        utm_source: searchParams.get('utm_source') || undefined,
        utm_medium: searchParams.get('utm_medium') || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
      });
      setSubmitting(false);
      setChecking(true);
      await new Promise((r) => setTimeout(r, 10000));
      setApprovalResult({
        approved: data.auto_approved,
        redirect_url: data.redirect_url,
        message: data.approved_message,
      });
      setChecking(false);
      setSubmitted(true);
    } catch (err: any) {
      setServerError(
        err.response?.data?.error || 'Something went wrong. Please try again.'
      );
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-canvas-300 border-t-iris-500" />
      </div>
    );
  }

  if (formDisabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas-100 px-4">
        <div className="card-saas w-full max-w-lg p-12 text-center">
          <span className="badge-prism mb-6">Currently Paused</span>
          <h2 className="font-display-saas text-3xl font-bold tracking-tight text-canvas-900 sm:text-4xl">
            Applications closed.
          </h2>
          <p className="mt-3 text-canvas-500">
            We&apos;re not accepting submissions right now. Please check back soon.
          </p>
        </div>
      </div>
    );
  }

  if (checking || submitted) {
    return <SubmissionResultScreen checking={checking} result={approvalResult} />;
  }

  return (
    <div className="min-h-screen bg-canvas-100">
      <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 lg:px-10">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-canvas-900">
              <span className="bg-prism h-3.5 w-3.5 rounded-[5px]" />
            </span>
            <span className="font-display-saas text-base font-bold tracking-tight text-canvas-900">
              SquadHire
            </span>
            <span className="hidden font-mono-editorial text-[11px] tracking-[0.06em] text-canvas-400 sm:inline">
              · CR—001
            </span>
          </div>
          <span className="pill-live">Accepting Applications</span>
        </div>

        {/* Hero card */}
        <header className="saas-lift card-hero relative mt-6 overflow-hidden px-6 py-10 sm:mt-8 sm:px-12 sm:py-14 lg:px-16 lg:py-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.18] blur-3xl"
            style={{
              backgroundImage:
                'linear-gradient(96deg, #FF8B47 0%, #FF5B8B 28%, #D24DFF 52%, #8B66F8 76%, #5BB7FF 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-[0.12] blur-3xl"
            style={{
              backgroundImage:
                'linear-gradient(96deg, #5BB7FF 0%, #8B66F8 50%, #FF5B8B 100%)',
            }}
          />

          <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <span className="badge-prism">Talent · Creative Track</span>
              <h1 className="font-display-saas mt-7 text-4xl font-bold leading-[1.05] text-canvas-900 sm:text-5xl lg:text-[56px]">
                For designers and editors{' '}
                <span className="text-prism text-prism-animated">who care about craft.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-canvas-600 sm:text-lg">
                Tell us who you are, share your work — we&rsquo;ll match you with employers
                who care about craft as much as you do. Four chapters, about three minutes.
              </p>
            </div>

            <div className="surface-saas grid grid-cols-2 gap-6 px-6 py-6">
              <div>
                <p className="font-display-saas text-3xl font-bold text-canvas-900">04</p>
                <p className="mt-1 text-xs font-medium text-canvas-500">Chapters</p>
              </div>
              <div>
                <p className="font-display-saas text-3xl font-bold text-canvas-900">~3m</p>
                <p className="mt-1 text-xs font-medium text-canvas-500">Time</p>
              </div>
              <div>
                <p className="font-display-saas text-3xl font-bold text-canvas-900">10s</p>
                <p className="mt-1 text-xs font-medium text-canvas-500">Auto-review</p>
              </div>
              <div>
                <p className="font-display-saas text-prism text-3xl font-bold">∞</p>
                <p className="mt-1 text-xs font-medium text-canvas-500">Possibilities</p>
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="pb-20">
          {serverError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Section
            index="01"
            title="Personal Details"
            description="Who you are."
            delay={0.05}
          >
            <div className="field-saas">
              <Input
                label="Name"
                required
                placeholder="Your full name"
                value={form.name}
                onChange={set('name')}
                error={errors.name}
              />
            </div>

            <div className="field-saas">
              <label className="block">WhatsApp Number<span className="ml-1 text-iris-500">*</span></label>
              <div className="mt-2 flex items-stretch gap-2">
                <select
                  className="w-[100px] shrink-0 rounded-xl border border-canvas-200 bg-canvas-50 px-2 text-sm font-medium text-canvas-600"
                  value={countryCode}
                  onChange={(e) => {
                    const newCode = e.target.value;
                    const digits = form.phone.replace(countryCode, '');
                    setCountryCode(newCode);
                    setForm((prev) => ({ ...prev, phone: newCode + digits }));
                  }}
                >
                  {COUNTRY_CODES.map((cc) => (
                    <option key={cc.code} value={cc.code}>{cc.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  className="flex-1"
                  placeholder="Phone number"
                  value={form.phone.replace(countryCode, '')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 15);
                    setForm((prev) => ({ ...prev, phone: countryCode + digits }));
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                    dup.clearPhone();
                  }}
                  onBlur={() => {
                    const digits = form.phone.replace(countryCode, '');
                    if (digits.length >= 7) dup.checkPhone(digits);
                  }}
                />
              </div>
              {errors.phone && <p className="mt-2 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <div className="field-saas">
              <Input
                label="Email"
                type="email"
                required
                placeholder="you@email.com"
                value={form.email}
                onChange={(e) => {
                  set('email')(e);
                  dup.clearEmail();
                }}
                onBlur={() => dup.checkEmail(form.email)}
                error={errors.email}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="field-saas">
                <Input
                  label="Age"
                  required
                  type="number"
                  placeholder="Years"
                  value={form.age}
                  onChange={set('age')}
                  error={errors.age}
                />
              </div>
              <div className="field-saas">
                <Select
                  label="Gender"
                  required
                  placeholder="Select"
                  options={GENDER_OPTIONS}
                  value={form.gender}
                  onChange={set('gender')}
                  error={errors.gender}
                />
              </div>
            </div>
          </Section>

          <Section
            index="02"
            title="Location"
            description="Where you&rsquo;re based."
            delay={0.1}
          >
            <div className="field-saas">
              <Select
                label="Country"
                required
                options={COUNTRIES}
                value={form.country}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                    state: '',
                    current_district: '',
                  }));
                  setErrors((prev) => ({ ...prev, country: undefined, state: undefined, current_district: undefined }));
                }}
                error={errors.country}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="field-saas">
                {form.country === 'India' ? (
                  <Select
                    label="State"
                    required
                    placeholder="Select state"
                    options={INDIAN_STATES}
                    value={form.state}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, state: e.target.value, current_district: '' }));
                      setErrors((prev) => ({ ...prev, state: undefined, current_district: undefined }));
                    }}
                    error={errors.state}
                  />
                ) : (
                  <Input
                    label="State / Region"
                    required
                    placeholder="State or region"
                    value={form.state}
                    onChange={set('state')}
                    error={errors.state}
                  />
                )}
              </div>
              <div className="field-saas">
                {form.country === 'India' && form.state ? (
                  <Select
                    label="District"
                    required
                    placeholder="Select district"
                    options={(DISTRICTS_BY_STATE[form.state] || []).map((d) => ({
                      label: d,
                      value: d,
                    }))}
                    value={form.current_district}
                    onChange={set('current_district')}
                    error={errors.current_district}
                  />
                ) : (
                  <Input
                    label="District"
                    required
                    placeholder={form.country === 'India' ? 'Select a state first' : 'District'}
                    value={form.current_district}
                    onChange={set('current_district')}
                    disabled={form.country === 'India' && !form.state}
                    error={errors.current_district}
                  />
                )}
              </div>
            </div>
          </Section>

          <Section
            index="03"
            title="Practice"
            description="The work you do, the work you want."
            delay={0.15}
          >
            <div>
              <p className="mb-3 text-sm font-medium text-canvas-700">
                Role<span className="ml-1 text-iris-500">*</span>
              </p>
              <ChipSelect
                multi
                options={CREATIVE_ROLES}
                selected={form.role}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, role: v as string[] }));
                  setErrors((prev) => ({ ...prev, role: undefined }));
                }}
                error={errors.role}
                chipClassName={chipStyle}
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-canvas-700">
                What are you looking for?<span className="ml-1 text-iris-500">*</span>
              </p>
              <ChipSelect
                multi
                options={WORK_TYPE_SEEKING_OPTIONS}
                selected={form.work_type_seeking}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, work_type_seeking: v as string[] }));
                  setErrors((prev) => ({ ...prev, work_type_seeking: undefined }));
                }}
                error={errors.work_type_seeking}
                chipClassName={chipStyle}
              />
            </div>

            <div className="field-saas">
              <Input
                label="Years of Experience"
                required
                placeholder="0 if fresher"
                value={form.experience_years}
                onChange={set('experience_years')}
                error={errors.experience_years}
              />
            </div>
          </Section>

          <Section
            index="04"
            title="Portfolio"
            description="Show us your work."
            delay={0.2}
          >
            <div className="field-saas">
              <Input
                label="Portfolio Link"
                required
                placeholder="https://..."
                value={form.portfolio_link}
                onChange={set('portfolio_link')}
                error={errors.portfolio_link}
              />
              <p className="mt-2 text-sm text-canvas-500">
                No portfolio? Upload your files to a Drive and paste the link.
              </p>
            </div>
          </Section>

          {/* Submit */}
          <div className="card-saas mt-5 flex flex-col gap-6 px-6 py-9 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-9">
            {dup.anyDuplicate && (
              <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 sm:w-auto sm:flex-1">
                You&rsquo;ve already submitted.{' '}
                <button
                  type="button"
                  onClick={() => dup.setShowModal(true)}
                  className="font-semibold underline underline-offset-4 hover:text-amber-900"
                >
                  Contact Talent Support
                </button>
              </div>
            )}

            {!dup.anyDuplicate && (
              <div className="flex-1">
                <p className="font-display-saas text-xl font-bold text-canvas-900 sm:text-2xl">
                  Ready when you are.
                </p>
                <p className="mt-1 text-sm text-canvas-500">
                  We&rsquo;ll review and respond within minutes.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={dup.anyDuplicate || submitting}
              className="btn-iris w-full sm:w-auto sm:min-w-[220px]"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit Application
                  <span className="arrow">→</span>
                </>
              )}
            </button>
          </div>

          <p className="mt-10 text-center text-xs text-canvas-400">
            SquadHire · Powered by UpSquad · 2026
          </p>
        </form>
      </div>

      <AlreadySubmittedModal
        open={dup.showModal}
        onClose={() => dup.setShowModal(false)}
      />
    </div>
  );
}
