'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
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
  ACCOUNTING_SOFTWARE,
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
  terms_accepted: string;
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
  terms_accepted: '',
};

const TERMS = [
  'First 3 Months will be probation and training',
  'If Selected you need to join within a week',
  'You need to have a Laptop, Smartphone and reliable Internet to undertake this work.',
  'Work will be Online, At Office or Hybrid model, based on opening',
];

const inputClass = 'border-primary-200 shadow-none focus:ring-1 focus:ring-[#1a1a1a]/20 focus:border-[#1a1a1a]/40';
const selectClass = inputClass;
const chipStyle = {
  selected: 'border-[#1a1a1a] bg-[#1a1a1a] text-white shadow-none',
  unselected: 'border-primary-300 bg-white text-primary-800 hover:border-primary-500 hover:bg-primary-50',
};

export default function AccountantLeadForm() {
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

  const validate = (): boolean => {
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
    if (form.terms_accepted !== 'yes') errs.terms_accepted = 'You must accept the terms';

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
        terms_accepted: true,
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1a1a1a] border-t-transparent" />
      </div>
    );
  }

  if (formDisabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center ring-1 ring-primary-200">
          <h2 className="font-serif-display text-2xl text-[#1a1a1a]">
            Applications Closed
          </h2>
          <p className="mt-2 text-primary-500">
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
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-16 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="editorial-header mb-12 text-center">
          <h1 className="font-serif-display text-4xl tracking-tight text-[#1a1a1a] sm:text-5xl">
            SquadHire
          </h1>
          <div className="mx-auto mt-3 w-12 border-t border-primary-300" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-primary-500">
            Talent Platform
          </p>
        </div>

        <div className="editorial-card rounded-2xl bg-white p-8 ring-1 ring-primary-200 sm:p-12">
          <h2 className="font-serif-display text-2xl text-[#1a1a1a] sm:text-3xl">
            Join as an Accountant
          </h2>
          <p className="mt-1 text-sm text-primary-500">
            Fill in your details to apply. Fields marked with * are required.
          </p>

          {serverError && (
            <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-10">
            {/* ── Section 1: Personal Details ── */}
            <div className="editorial-section space-y-5" style={{ animationDelay: '0.08s' }}>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-500">
                Personal Details
              </p>

              <Input
                label="Your Name"
                required
                placeholder="Full name"
                value={form.name}
                onChange={set('name')}
                error={errors.name}
                className={inputClass}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Contact Number<span className="ml-0.5 text-red-500">*</span>
                </label>
                <p className="mb-1 text-xs text-primary-400">Ideally a WhatsApp Number</p>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-lg border border-r-0 border-primary-200 bg-primary-50 px-3 text-sm text-primary-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={`block w-full rounded-r-lg border px-3 py-2 text-sm transition-colors placeholder:text-primary-400 focus:outline-none focus:ring-1 focus:ring-[#1a1a1a]/20 ${
                      errors.phone
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-primary-200 focus:border-[#1a1a1a]/40'
                    }`}
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
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>

              <Input
                label="Age"
                required
                type="number"
                placeholder="Your age"
                value={form.age}
                onChange={set('age')}
                error={errors.age}
                className={inputClass}
              />

              <Select
                label="Gender"
                required
                placeholder="Select option..."
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={set('gender')}
                error={errors.gender}
                className={selectClass}
              />

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
                className={inputClass}
              />
            </div>

            {/* ── Section 2: Location ── */}
            <div
              className="editorial-section mt-10 space-y-5 border-t border-primary-200 pt-10"
              style={{ animationDelay: '0.16s' }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-500">
                Location
              </p>

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
                className={selectClass}
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
                  className={selectClass}
                />
              ) : (
                <Input
                  label="State / Region"
                  required
                  placeholder="State or region"
                  value={form.state}
                  onChange={set('state')}
                  error={errors.state}
                  className={inputClass}
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
                  className={selectClass}
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
                  className={inputClass}
                />
              )}

              <Input
                label="Native Place"
                required
                placeholder="Your native place"
                value={form.native_place}
                onChange={set('native_place')}
                error={errors.native_place}
                className={inputClass}
              />

              <Input
                label="Location"
                required
                placeholder="Current place of stay"
                value={form.location}
                onChange={set('location')}
                error={errors.location}
                helperText="Add the current place you are staying (to get job offer near that location)"
                className={inputClass}
              />

              <ChipSelect
                label="Preferred Work Districts"
                required
                multi
                options={KERALA_DISTRICTS}
                selected={form.district}
                onChange={(v) => setMulti('district')(v as string[])}
                error={errors.district}
                helperText="Select the districts where you prefer to work or get job opening requests from (If you are outside India - select the last option)"
                chipClassName={chipStyle}
              />
            </div>

            {/* ── Section 3: Work Preferences ── */}
            <div
              className="editorial-section mt-10 space-y-5 border-t border-primary-200 pt-10"
              style={{ animationDelay: '0.24s' }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-500">
                Work Preferences
              </p>

              <ChipSelect
                label="Type of Work"
                required
                multi
                options={WORK_TYPE_OPTIONS}
                selected={form.work_type}
                onChange={(v) => setMulti('work_type')(v as string[])}
                error={errors.work_type}
                chipClassName={chipStyle}
              />

              <ChipSelect
                label="What type of work are you looking for?"
                required
                multi
                options={WORK_TYPE_SEEKING_OPTIONS}
                selected={form.work_type_seeking}
                onChange={(v) => setMulti('work_type_seeking')(v as string[])}
                error={errors.work_type_seeking}
                chipClassName={chipStyle}
              />
            </div>

            {/* ── Section 4: Professional Background ── */}
            <div
              className="editorial-section mt-10 space-y-5 border-t border-primary-200 pt-10"
              style={{ animationDelay: '0.32s' }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-500">
                Professional Background
              </p>

              <Textarea
                label="Educational Qualifications"
                required
                placeholder="Your qualifications"
                value={form.education}
                onChange={set('education')}
                error={errors.education}
                className={inputClass}
              />

              <Input
                label="Years of Experience as an Accountant"
                required
                placeholder="e.g. 3"
                value={form.experience_years}
                onChange={set('experience_years')}
                error={errors.experience_years}
                helperText="Add Zero if you are a fresher"
                className={inputClass}
              />

              <div>
                <ChipSelect
                  label="Accounting Softwares"
                  required
                  multi
                  options={ACCOUNTING_SOFTWARE_PRIMARY}
                  selected={form.accounting_software}
                  onChange={(v) => setMulti('accounting_software')(v as string[])}
                  error={errors.accounting_software}
                  helperText="Select the ones you have experience in (you can select multiple ones)"
                  chipClassName={chipStyle}
                />
                <div className="mt-2">
                  <MultiSelectSearch
                    options={ACCOUNTING_SOFTWARE_OTHER}
                    selected={form.accounting_software}
                    onChange={setMulti('accounting_software')}
                    placeholder="Search more software..."
                  />
                </div>
              </div>

              <ChipSelect
                label="Add on Accounting Skills"
                multi
                options={ACCOUNTING_SKILLS}
                selected={form.addon_skills}
                onChange={(v) => setMulti('addon_skills')(v as string[])}
                helperText="Select the options you have (you can select multiple ones)"
                chipClassName={chipStyle}
              />
            </div>

            {/* ── Section 5: Compensation ── */}
            <div
              className="editorial-section mt-10 space-y-5 border-t border-primary-200 pt-10"
              style={{ animationDelay: '0.40s' }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-500">
                Compensation
              </p>

              <Input
                label="Current Salary per month"
                required
                type="number"
                placeholder="Amount in INR"
                value={form.current_salary}
                onChange={set('current_salary')}
                error={errors.current_salary}
                className={inputClass}
              />

              <Input
                label="Expected Salary per month"
                required
                type="number"
                placeholder="Amount in INR"
                value={form.expected_salary}
                onChange={set('expected_salary')}
                error={errors.expected_salary}
                className={inputClass}
              />

              <ChipSelect
                label="Languages You Speak"
                required
                multi
                options={LANGUAGES}
                selected={form.languages}
                onChange={(v) => setMulti('languages')(v as string[])}
                error={errors.languages}
                chipClassName={chipStyle}
              />
            </div>

            {/* ── Section 6: Additional Details ── */}
            <div
              className="editorial-section mt-10 space-y-5 border-t border-primary-200 pt-10"
              style={{ animationDelay: '0.48s' }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-500">
                Additional Details
              </p>

              <Textarea
                label="Details of Experiences"
                required
                placeholder="Write about your previous job experiences"
                value={form.experience_details}
                onChange={set('experience_details')}
                error={errors.experience_details}
                helperText="Write about the job experiences you had previously"
                className={inputClass}
              />

              {/* Resume Upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Upload Resume
                </label>
                <label
                  className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
                    errors.resume_url
                      ? 'border-red-300 bg-red-50'
                      : 'border-primary-200 bg-primary-50 hover:border-primary-400 hover:bg-primary-100'
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
                    <span className="text-primary-500">Uploading...</span>
                  ) : resumeFileName ? (
                    <span className="text-green-700">{resumeFileName} (uploaded)</span>
                  ) : (
                    <span className="text-primary-400">Drop your files here to upload</span>
                  )}
                </label>
                {errors.resume_url && (
                  <p className="mt-1 text-xs text-red-600">{errors.resume_url}</p>
                )}
              </div>

              {/* Terms */}
              <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                <h3 className="mb-3 text-sm font-medium text-primary-800">Terms:</h3>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-primary-700">
                  {TERMS.map((term, i) => (
                    <li key={i}>{term}</li>
                  ))}
                </ol>
              </div>

              <Select
                label="Accept Above Terms"
                required
                placeholder="Select option..."
                options={[
                  { label: 'Yes, I accept', value: 'yes' },
                  { label: 'No', value: 'no' },
                ]}
                value={form.terms_accepted}
                onChange={set('terms_accepted')}
                error={errors.terms_accepted}
                className={selectClass}
              />
            </div>

            {/* ── Submit ── */}
            <div className="mt-10 border-t border-primary-200 pt-10">
              {dup.anyDuplicate && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
                Submit
              </Button>
            </div>
          </form>

          <p className="mt-10 text-center text-[10px] text-primary-400">
            Powered by UpSquad
          </p>
        </div>
      </div>
      <AlreadySubmittedModal
        open={dup.showModal}
        onClose={() => dup.setShowModal(false)}
      />
    </div>
  );
}
