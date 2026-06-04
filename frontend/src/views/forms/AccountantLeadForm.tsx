'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import ChipSelect from '@/components/ui/ChipSelect';
import AlreadySubmittedModal from '@/components/forms/AlreadySubmittedModal';
import SubmissionResultScreen from '@/components/forms/SubmissionResultScreen';
import { useDuplicateContactCheck } from '@/hooks/useDuplicateContactCheck';
import {
  GENDER_OPTIONS,
  WORK_TYPE_OPTIONS,
  WORK_TYPE_SEEKING_OPTIONS,
  KERALA_DISTRICTS,
  ACCOUNTING_SOFTWARE_PRIMARY,
  ACCOUNTING_SOFTWARE_OTHER,
  ACCOUNTING_SKILLS,
  LANGUAGES,
} from '@/constants/lead-form-options';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';

interface FormValues {
  name: string;
  phone: string;
  age: string;
  gender: string;
  country: string;
  state: string;
  current_district: string;
  native_place: string;
  district: string[];
  location: string;
  work_type: string[];
  work_type_seeking: string[];
  education: string;
  experience_years: string;
  accounting_software: string[];
  addon_skills: string[];
  current_salary: string;
  expected_salary: string;
  languages: string[];
  email: string;
  experience_details: string;
  resume_url: string;
}

const initial: FormValues = {
  name: '',
  phone: '',
  age: '',
  gender: '',
  country: 'India',
  state: '',
  current_district: '',
  native_place: '',
  district: [],
  location: '',
  work_type: [],
  work_type_seeking: [],
  education: '',
  experience_years: '',
  accounting_software: [],
  addon_skills: [],
  current_salary: '',
  expected_salary: '',
  languages: [],
  email: '',
  experience_details: '',
  resume_url: '',
};

const chipStyle = {
  selected:
    'border-cu-900 bg-cu-900 text-white shadow-[0_2px_8px_-2px_rgba(24,24,27,0.18)]',
  unselected:
    'border-cu-200 bg-white text-cu-700 hover:border-cu-400 hover:bg-cu-50',
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

export default function AccountantLeadForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [shakeWarning, setShakeWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    approved: boolean;
    redirect_url?: string;
    message?: string;
  } | null>(null);
  const [serverError, setServerError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [resumeFileName, setResumeFileName] = useState('');
  const [formDisabled, setFormDisabled] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const dup = useDuplicateContactCheck();

  useEffect(() => {
    axios
      .get('/api/leads/form-status/accountant')
      .then((res) => {
        if (!res.data.enabled) setFormDisabled(true);
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, []);

  const set = (key: keyof FormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setMulti = (key: keyof FormValues) => (values: string[]) => {
    setForm((prev) => ({ ...prev, [key]: values }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrors((prev) => ({ ...prev, resume_url: undefined }));
    try {
      const { data } = await axios.post('/api/leads/upload-url', {
        filename: file.name,
        content_type: file.type,
      });

      await fetch(data.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      setForm((prev) => ({ ...prev, resume_url: data.file_url }));
      setResumeFileName(file.name);
    } catch {
      setErrors((prev) => ({ ...prev, resume_url: 'Upload failed. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const FIELD_ORDER: (keyof FormValues)[] = [
    'name',
    'phone',
    'age',
    'gender',
    'country',
    'state',
    'current_district',
    'native_place',
    'district',
    'location',
    'work_type',
    'work_type_seeking',
    'education',
    'experience_years',
    'accounting_software',
    'current_salary',
    'expected_salary',
    'languages',
    'email',
    'experience_details',
  ];

  const validate = (): { ok: boolean; errs: Partial<Record<keyof FormValues, string>> } => {
    const errs: Partial<Record<keyof FormValues, string>> = {};

    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.phone.trim()) errs.phone = 'Contact number is required';
    else if (!/^\+?91[6-9]\d{9}$/.test(form.phone.replace(/\s/g, '')))
      errs.phone = 'Enter a valid 10-digit mobile number';
    if (!form.age.trim()) errs.age = 'Age is required';
    else if (isNaN(Number(form.age)) || Number(form.age) < 16 || Number(form.age) > 100)
      errs.age = 'Enter a valid age (16-100)';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!form.country) errs.country = 'Country is required';
    if (!form.state.trim()) errs.state = 'State is required';
    if (!form.current_district.trim()) errs.current_district = 'District is required';
    if (!form.native_place.trim()) errs.native_place = 'Native place is required';
    if (form.district.length === 0) errs.district = 'Select at least one district';
    if (!form.location.trim()) errs.location = 'Location is required';
    if (form.work_type.length === 0) errs.work_type = 'Select at least one work type';
    if (form.work_type_seeking.length === 0) errs.work_type_seeking = 'Select at least one option';
    if (!form.education.trim()) errs.education = 'Educational qualifications are required';
    if (!form.experience_years.trim()) errs.experience_years = 'Years of experience is required';
    if (form.accounting_software.length === 0) errs.accounting_software = 'Select at least one software';
    if (!form.current_salary.trim()) errs.current_salary = 'Current salary is required';
    else if (isNaN(Number(form.current_salary)) || Number(form.current_salary) < 0)
      errs.current_salary = 'Enter a valid amount';
    if (!form.expected_salary.trim()) errs.expected_salary = 'Expected salary is required';
    else if (isNaN(Number(form.expected_salary)) || Number(form.expected_salary) < 0)
      errs.expected_salary = 'Enter a valid amount';
    if (form.languages.length === 0) errs.languages = 'Select at least one language';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email';
    if (!form.experience_details.trim()) errs.experience_details = 'Experience details are required';

    setErrors(errs);
    return { ok: Object.keys(errs).length === 0, errs };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (dup.anyDuplicate) {
      setShakeWarning(true);
      setTimeout(() => setShakeWarning(false), 450);
      document
        .getElementById('duplicate-warning')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const { ok, errs } = validate();
    if (!ok) {
      const firstErrorKey = FIELD_ORDER.find((k) => errs[k]);
      if (firstErrorKey) {
        requestAnimationFrame(() => {
          document
            .getElementById(`field-${firstErrorKey}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post('/api/leads/submit', {
        form_type: 'accountant',
        name: form.name.trim(),
        phone: form.phone.replace(/\s/g, ''),
        email: form.email.trim(),
        age: Number(form.age),
        gender: form.gender,
        country: form.country,
        state: form.state.trim(),
        current_district: form.current_district.trim(),
        native_place: form.native_place.trim(),
        district: form.district,
        location: form.location.trim(),
        work_type: form.work_type,
        work_type_seeking: form.work_type_seeking,
        education: form.education.trim(),
        experience_years: form.experience_years.trim(),
        accounting_software: form.accounting_software,
        addon_skills: form.addon_skills,
        current_salary: Number(form.current_salary),
        expected_salary: Number(form.expected_salary),
        languages: form.languages,
        experience_details: form.experience_details.trim(),
        resume_url: form.resume_url || undefined,
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-canvas-300 border-t-cu-900" />
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
              · AC—001
            </span>
          </div>
          <span className="pill-live">Accepting Applications</span>
        </div>

        {/* Hero card */}
        <header className="saas-lift card-hero relative mt-3 overflow-hidden px-6 py-4 sm:mt-8 sm:px-12 sm:py-14 lg:px-16 lg:py-16">
          {/* Iridescent decorative blob, top-right */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-[0.18] blur-3xl"
            style={{
              backgroundImage:
                'linear-gradient(96deg, #FF8B47 0%, #FF5B8B 28%, #D24DFF 52%, #FCF487 76%, #5BB7FF 100%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full opacity-[0.12] blur-3xl"
            style={{
              backgroundImage:
                'linear-gradient(96deg, #5BB7FF 0%, #FCF487 50%, #FF5B8B 100%)',
            }}
          />

          <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <span className="badge-prism">Talent · Accountant Track</span>
              <h1 className="font-display-saas mt-2 text-2xl font-bold leading-[1.1] text-canvas-900 sm:text-5xl sm:leading-[1.05] lg:text-[56px]">
                The only platform built for accountants{' '}
                <span className="text-prism text-prism-animated">who care about craft.</span>
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-canvas-600 sm:mt-3 sm:text-lg">
                We match you with employers that respect your expertise — full-time, freelance, hybrid.
                Six chapters. About five minutes.
              </p>
            </div>

            <div className="surface-saas grid grid-cols-2 gap-3 px-4 py-3 sm:gap-6 sm:px-5 sm:py-4">
              <div>
                <p className="font-display-saas text-lg font-bold text-canvas-900 sm:text-2xl">06</p>
                <p className="mt-0.5 text-xs font-medium text-canvas-500 sm:mt-1">Chapters</p>
              </div>
              <div>
                <p className="font-display-saas text-lg font-bold text-canvas-900 sm:text-2xl">~5m</p>
                <p className="mt-0.5 text-xs font-medium text-canvas-500 sm:mt-1">Time</p>
              </div>
              <div>
                <p className="font-display-saas text-lg font-bold text-canvas-900 sm:text-2xl">10s</p>
                <p className="mt-0.5 text-xs font-medium text-canvas-500 sm:mt-1">Auto-review</p>
              </div>
              <div>
                <p className="font-display-saas text-lg font-bold text-canvas-900 text-prism sm:text-2xl">∞</p>
                <p className="mt-0.5 text-xs font-medium text-canvas-500 sm:mt-1">Possibilities</p>
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={handleSubmit} noValidate className="pb-20">
          {serverError && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <Section
            index="01"
            title="Personal Details"
            description="The basics — so we know who we&rsquo;re talking to."
            delay={0.05}
          >
            <div id="field-name" className="field-saas">
              <Input
                label="Your Name"
                required
                placeholder="Full name"
                value={form.name}
                onChange={set('name')}
                error={errors.name}
              />
            </div>

            <div id="field-phone" className="field-saas">
              <label className="block">Contact Number<span className="ml-1 text-red-500">*</span></label>
              <p className="-mt-1 mb-2 text-xs text-canvas-500">Ideally a WhatsApp number.</p>
              <div className="flex items-stretch gap-2">
                <span className="inline-flex items-center rounded-xl border border-canvas-200 bg-canvas-50 px-3.5 text-sm font-medium text-canvas-600">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="flex-1"
                  placeholder="10-digit mobile"
                  value={form.phone.replace(/^\+91/, '')}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, '');
                    while (digits.length > 10 && digits.startsWith('91')) {
                      digits = digits.slice(2);
                    }
                    digits = digits.slice(0, 10);
                    setForm((prev) => ({ ...prev, phone: '+91' + digits }));
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                    dup.clearPhone();
                  }}
                  onBlur={() => {
                    const digits = form.phone.replace(/^\+91/, '');
                    if (digits.length === 10) dup.checkPhone(digits);
                  }}
                />
              </div>
              {errors.phone && <p className="mt-2 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div id="field-age" className="field-saas">
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
              <div id="field-gender" className="field-saas">
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

            <div id="field-email" className="field-saas">
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
          </Section>

          <Section
            index="02"
            title="Location"
            description="Where you&rsquo;re from, and where you&rsquo;d like to work."
            delay={0.1}
          >
            <div id="field-country" className="field-saas">
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
                  setErrors((prev) => ({
                    ...prev,
                    country: undefined,
                    state: undefined,
                    current_district: undefined,
                  }));
                }}
                error={errors.country}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div id="field-state" className="field-saas">
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
              <div id="field-current_district" className="field-saas">
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

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div id="field-native_place" className="field-saas">
                <Input
                  label="Native Place"
                  required
                  placeholder="Your native place"
                  value={form.native_place}
                  onChange={set('native_place')}
                  error={errors.native_place}
                />
              </div>
              <div id="field-location" className="field-saas">
                <Input
                  label="Current Location"
                  required
                  placeholder="Where you&rsquo;re staying"
                  value={form.location}
                  onChange={set('location')}
                  error={errors.location}
                />
              </div>
            </div>

            <div id="field-district">
              <p className="mb-2 text-sm font-medium text-canvas-700">
                Preferred Work Districts<span className="ml-1 text-red-500">*</span>
              </p>
              <p className="mb-3 text-sm text-canvas-500">
                Where you&rsquo;d like to work. Outside India? Pick the last option.
              </p>
              <ChipSelect
                multi
                options={KERALA_DISTRICTS}
                selected={form.district}
                onChange={(v) => setMulti('district')(v as string[])}
                error={errors.district}
                chipClassName={chipStyle}
              />
            </div>
          </Section>

          <Section
            index="03"
            title="Work Preferences"
            description="The shape of work that suits you."
            delay={0.15}
          >
            <div id="field-work_type">
              <p className="mb-3 text-sm font-medium text-canvas-700">
                Type of Work<span className="ml-1 text-red-500">*</span>
              </p>
              <ChipSelect
                multi
                options={WORK_TYPE_OPTIONS}
                selected={form.work_type}
                onChange={(v) => setMulti('work_type')(v as string[])}
                error={errors.work_type}
                chipClassName={chipStyle}
              />
            </div>
            <div id="field-work_type_seeking">
              <p className="mb-3 text-sm font-medium text-canvas-700">
                What are you looking for?<span className="ml-1 text-red-500">*</span>
              </p>
              <ChipSelect
                multi
                options={WORK_TYPE_SEEKING_OPTIONS}
                selected={form.work_type_seeking}
                onChange={(v) => setMulti('work_type_seeking')(v as string[])}
                error={errors.work_type_seeking}
                chipClassName={chipStyle}
              />
            </div>
          </Section>

          <Section
            index="04"
            title="Professional Background"
            description="Your training, your tools, your craft."
            delay={0.2}
          >
            <div id="field-education" className="field-saas">
              <Textarea
                label="Educational Qualifications"
                required
                placeholder="Your qualifications"
                value={form.education}
                onChange={set('education')}
                error={errors.education}
              />
            </div>
            <div id="field-experience_years" className="field-saas">
              <Input
                label="Years of Experience"
                required
                placeholder="0 if fresher"
                value={form.experience_years}
                onChange={set('experience_years')}
                error={errors.experience_years}
              />
            </div>

            <div id="field-accounting_software">
              <p className="mb-2 text-sm font-medium text-canvas-700">
                Accounting Software<span className="ml-1 text-red-500">*</span>
              </p>
              <p className="mb-3 text-sm text-canvas-500">
                The ones you have hands-on experience with.
              </p>
              <ChipSelect
                multi
                options={ACCOUNTING_SOFTWARE_PRIMARY}
                selected={form.accounting_software}
                onChange={(v) => setMulti('accounting_software')(v as string[])}
                error={errors.accounting_software}
                chipClassName={chipStyle}
              />
              <div className="field-saas mt-3">
                <MultiSelectSearch
                  options={ACCOUNTING_SOFTWARE_OTHER}
                  selected={form.accounting_software}
                  onChange={setMulti('accounting_software')}
                  placeholder="Search more software..."
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-canvas-700">Add-on Skills</p>
              <ChipSelect
                multi
                options={ACCOUNTING_SKILLS}
                selected={form.addon_skills}
                onChange={(v) => setMulti('addon_skills')(v as string[])}
                chipClassName={chipStyle}
              />
            </div>
          </Section>

          <Section
            index="05"
            title="Compensation"
            description="What you earn now, and what you&rsquo;d like to."
            delay={0.25}
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div id="field-current_salary" className="field-saas">
                <Input
                  label="Current Salary / month"
                  required
                  type="number"
                  placeholder="₹"
                  value={form.current_salary}
                  onChange={set('current_salary')}
                  error={errors.current_salary}
                />
              </div>
              <div id="field-expected_salary" className="field-saas">
                <Input
                  label="Expected Salary / month"
                  required
                  type="number"
                  placeholder="₹"
                  value={form.expected_salary}
                  onChange={set('expected_salary')}
                  error={errors.expected_salary}
                />
              </div>
            </div>

            <div id="field-languages">
              <p className="mb-3 text-sm font-medium text-canvas-700">
                Languages<span className="ml-1 text-red-500">*</span>
              </p>
              <ChipSelect
                multi
                options={LANGUAGES}
                selected={form.languages}
                onChange={(v) => setMulti('languages')(v as string[])}
                error={errors.languages}
                chipClassName={chipStyle}
              />
            </div>
          </Section>

          <Section
            index="06"
            title="Final Details"
            description="Resume, send-off."
            delay={0.3}
          >
            <div id="field-experience_details" className="field-saas">
              <Textarea
                label="Details of Experience"
                required
                placeholder="Write about your previous job experiences"
                value={form.experience_details}
                onChange={set('experience_details')}
                error={errors.experience_details}
              />
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-canvas-700">Upload Resume</p>
              <label
                className={`group flex cursor-pointer items-center justify-between rounded-2xl border border-dashed px-5 py-5 text-sm transition-all ${
                  errors.resume_url
                    ? 'border-red-300 bg-red-50/40'
                    : resumeFileName
                    ? 'border-green-400 bg-green-50/60'
                    : 'border-canvas-300 bg-canvas-50 hover:border-cu-900 hover:bg-brand-purple/20'
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                  onChange={handleResumeUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-canvas-500">Uploading…</span>
                ) : resumeFileName ? (
                  <>
                    <span className="font-medium text-green-700">✓ {resumeFileName}</span>
                    <span className="text-xs font-medium text-green-600">Uploaded</span>
                  </>
                ) : (
                  <>
                    <span className="text-canvas-600 group-hover:text-cu-900">
                      Drop a file or click to browse
                    </span>
                    <span className="text-xs font-medium text-canvas-400">PDF · DOC · JPG</span>
                  </>
                )}
              </label>
              {errors.resume_url && (
                <p className="mt-2 text-xs text-red-600">{errors.resume_url}</p>
              )}
            </div>

          </Section>

          {/* Submit */}
          <div className="card-saas mt-5 flex flex-col gap-6 px-6 py-9 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-9">
            {dup.anyDuplicate && (
              <div
                id="duplicate-warning"
                className={`w-full rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 sm:w-auto sm:flex-1 ${shakeWarning ? 'animate-shake-x' : ''}`}
              >
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
              disabled={submitting}
              className="btn-iridescent w-full sm:w-auto sm:min-w-[220px]"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit Application
                  <span className="arrow-icon">→</span>
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
