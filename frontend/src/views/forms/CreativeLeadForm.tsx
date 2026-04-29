'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ChipSelect from '@/components/ui/ChipSelect';
import { CREATIVE_ROLES, WORK_TYPE_SEEKING_OPTIONS, GENDER_OPTIONS } from '@/constants/lead-form-options';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';
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

export default function CreativeLeadForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initial);
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
    else if (!/^\+?91[6-9]\d{9}$/.test(form.phone.replace(/\s/g, '')))
      errs.phone = 'Enter a valid 10-digit mobile number';
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
    if (!validate()) return;

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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (formDisabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-neutral-900">
            Applications Closed
          </h2>
          <p className="mt-2 text-neutral-500">
            This form is currently not accepting applications. Please check back later.
          </p>
        </div>
      </div>
    );
  }

  if (checking || submitted) {
    return (
      <SubmissionResultScreen checking={checking} result={approvalResult} />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            SquadHire
          </h1>
          <p className="mt-0.5 text-xs text-neutral-400">Powered by UpSquad</p>
          <p className="mt-1 text-sm text-neutral-500">Talent Platform</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900">
            Join as a Designer / Editor
          </h2>
          <p className="mb-6 text-sm text-neutral-500">
            Fill in your details to apply. All fields are required.
          </p>

          {serverError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Name"
              required
              placeholder="Your full name"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                WhatsApp Number<span className="ml-0.5 text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className={`block w-full rounded-r-lg border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.phone
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-indigo-500'
                  }`}
                  placeholder="10-digit mobile"
                  value={form.phone.replace(/^\+91/, '')}
                  onChange={(e) => {
                    let digits = e.target.value.replace(/\D/g, '');
                    // Candidate pasted "+91..." or typed 91 at the start — strip duplicates.
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
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <Input
              label="Email"
              type="email"
              required
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => {
                set('email')(e);
                dup.clearEmail();
              }}
              onBlur={() => dup.checkEmail(form.email)}
              error={errors.email}
            />

            <Input
              label="Age"
              required
              type="number"
              placeholder="Enter age"
              value={form.age}
              onChange={set('age')}
              error={errors.age}
            />

            <Select
              label="Gender"
              required
              placeholder="Select option..."
              options={GENDER_OPTIONS}
              value={form.gender}
              onChange={set('gender')}
              error={errors.gender}
            />

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

            <ChipSelect
              label="Role"
              required
              multi
              options={CREATIVE_ROLES}
              selected={form.role}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, role: v as string[] }));
                setErrors((prev) => ({ ...prev, role: undefined }));
              }}
              error={errors.role}
            />

            <ChipSelect
              label="What type of work are you looking for?"
              required
              multi
              options={WORK_TYPE_SEEKING_OPTIONS}
              selected={form.work_type_seeking}
              onChange={(v) => {
                setForm((prev) => ({ ...prev, work_type_seeking: v as string[] }));
                setErrors((prev) => ({ ...prev, work_type_seeking: undefined }));
              }}
              error={errors.work_type_seeking}
            />

            <Input
              label="Years of Experience"
              required
              placeholder="e.g. 2"
              value={form.experience_years}
              onChange={set('experience_years')}
              error={errors.experience_years}
              helperText="Add Zero if you are a fresher"
            />

            <Input
              label="Portfolio Link"
              required
              placeholder="https://drive.google.com/..."
              value={form.portfolio_link}
              onChange={set('portfolio_link')}
              error={errors.portfolio_link}
              helperText="If you don't have a portfolio, upload files to a drive and share that link"
            />

            {dup.anyDuplicate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                You have already submitted a request with us.{' '}
                <button
                  type="button"
                  onClick={() => dup.setShowModal(true)}
                  className="font-semibold underline hover:text-amber-900"
                >
                  Contact Talent Support
                </button>
              </div>
            )}

            <Button
              type="submit"
              loading={submitting}
              disabled={dup.anyDuplicate}
              className="w-full"
            >
              Submit Application
            </Button>
          </form>
        </div>
      </div>
      <AlreadySubmittedModal
        open={dup.showModal}
        onClose={() => dup.setShowModal(false)}
      />
    </div>
  );
}
