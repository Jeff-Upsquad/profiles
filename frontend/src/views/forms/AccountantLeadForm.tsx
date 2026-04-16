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
import {
  GENDER_OPTIONS,
  WORK_TYPE_OPTIONS,
  KERALA_DISTRICTS,
  ACCOUNTING_SOFTWARE,
  ACCOUNTING_SOFTWARE_PRIMARY,
  ACCOUNTING_SOFTWARE_OTHER,
  ACCOUNTING_SKILLS,
  LANGUAGES,
} from '@/constants/lead-form-options';

interface FormValues {
  name: string;
  phone: string;
  age: string;
  gender: string;
  native_place: string;
  district: string[];
  location: string;
  work_type: string[];
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
  native_place: '',
  district: [],
  location: '',
  work_type: [],
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

export default function AccountantLeadForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [resumeFileName, setResumeFileName] = useState('');
  const [formDisabled, setFormDisabled] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

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
      // Get presigned URL from public lead upload endpoint
      const { data } = await axios.post('/api/leads/upload-url', {
        filename: file.name,
        content_type: file.type,
      });

      // Upload to R2
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
    else if (!/^\+?[1-9]\d{9,14}$/.test(form.phone.replace(/\s/g, '')))
      errs.phone = 'Enter a valid phone number';
    if (!form.age.trim()) errs.age = 'Age is required';
    else if (isNaN(Number(form.age)) || Number(form.age) < 16 || Number(form.age) > 100)
      errs.age = 'Enter a valid age (16-100)';
    if (!form.gender) errs.gender = 'Gender is required';
    if (!form.native_place.trim()) errs.native_place = 'Native place is required';
    if (form.district.length === 0) errs.district = 'Select at least one district';
    if (!form.location.trim()) errs.location = 'Location is required';
    if (form.work_type.length === 0) errs.work_type = 'Select at least one work type';
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
    if (!form.resume_url) errs.resume_url = 'Resume is required';
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
      await axios.post('/api/leads/submit', {
        form_type: 'accountant',
        name: form.name.trim(),
        phone: form.phone.replace(/\s/g, ''),
        email: form.email.trim(),
        age: Number(form.age),
        gender: form.gender,
        native_place: form.native_place.trim(),
        district: form.district,
        location: form.location.trim(),
        work_type: form.work_type,
        education: form.education.trim(),
        experience_years: form.experience_years.trim(),
        accounting_software: form.accounting_software,
        addon_skills: form.addon_skills,
        current_salary: Number(form.current_salary),
        expected_salary: Number(form.expected_salary),
        languages: form.languages,
        experience_details: form.experience_details.trim(),
        resume_url: form.resume_url,
        terms_accepted: true,
        utm_source: searchParams.get('utm_source') || undefined,
        utm_medium: searchParams.get('utm_medium') || undefined,
        utm_campaign: searchParams.get('utm_campaign') || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setServerError(
        err.response?.data?.error || 'Something went wrong. Please try again.'
      );
    } finally {
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

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F6F3] px-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900">Thank You!</h2>
          <p className="mt-2 text-neutral-500">
            Your application has been submitted successfully. We&apos;ll review your profile and get back to you soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            SquadHire
          </h1>
          <p className="mt-1 text-sm text-neutral-500">Talent Platform</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900">
            Join as an Accountant
          </h2>
          <p className="mb-6 text-sm text-neutral-500">
            Fill in your details to apply. Fields marked with * are required.
          </p>

          {serverError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Your Name"
              required
              placeholder="Enter text"
              value={form.name}
              onChange={set('name')}
              error={errors.name}
            />

            {/* Phone with +91 prefix */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Contact Number<span className="ml-0.5 text-red-500">*</span>
              </label>
              <p className="mb-1 text-xs text-gray-500">Ideally a WhatsApp Number</p>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                  +91
                </span>
                <input
                  type="tel"
                  className={`block w-full rounded-r-lg border px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.phone
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-gray-300 focus:border-indigo-500'
                  }`}
                  placeholder="Enter phone"
                  value={form.phone.replace(/^\+91/, '')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^\d]/g, '');
                    setForm((prev) => ({
                      ...prev,
                      phone: '+91' + digits,
                    }));
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                />
              </div>
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
            </div>

            <Input
              label="Age"
              required
              type="number"
              placeholder="Enter text"
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

            <Input
              label="Native Place"
              required
              placeholder="Enter text"
              value={form.native_place}
              onChange={set('native_place')}
              error={errors.native_place}
            />

            <ChipSelect
              label="District"
              required
              multi
              options={KERALA_DISTRICTS}
              selected={form.district}
              onChange={(v) => setMulti('district')(v as string[])}
              error={errors.district}
              helperText="Select the districts where you prefer to work or get job opening requests from (If you are outside India - select the last option)"
            />

            <Input
              label="Location"
              required
              placeholder="Enter text"
              value={form.location}
              onChange={set('location')}
              error={errors.location}
              helperText="Add the current place you are staying (to get job offer near that location)"
            />

            <ChipSelect
              label="Type of Work"
              required
              multi
              options={WORK_TYPE_OPTIONS}
              selected={form.work_type}
              onChange={(v) => setMulti('work_type')(v as string[])}
              error={errors.work_type}
            />

            <Textarea
              label="Educational Qualifications"
              required
              placeholder="Enter text"
              value={form.education}
              onChange={set('education')}
              error={errors.education}
            />

            <Input
              label="Years of Experience as an Accountant"
              required
              placeholder="Enter text"
              value={form.experience_years}
              onChange={set('experience_years')}
              error={errors.experience_years}
              helperText="Add Zero if you are a fresher"
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
            />

            <Input
              label="Current Salary per month"
              required
              type="number"
              placeholder="Enter currency"
              value={form.current_salary}
              onChange={set('current_salary')}
              error={errors.current_salary}
            />

            <Input
              label="Expected Salary per month"
              required
              type="number"
              placeholder="Enter currency"
              value={form.expected_salary}
              onChange={set('expected_salary')}
              error={errors.expected_salary}
            />

            <ChipSelect
              label="Languages You Speak"
              required
              multi
              options={LANGUAGES}
              selected={form.languages}
              onChange={(v) => setMulti('languages')(v as string[])}
              error={errors.languages}
            />

            <Input
              label="Email"
              type="email"
              required
              placeholder="Enter email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
            />

            <Textarea
              label="Details of Experiences"
              required
              placeholder="Enter text"
              value={form.experience_details}
              onChange={set('experience_details')}
              error={errors.experience_details}
              helperText="Write about the job experiences you had previously"
            />

            {/* Resume Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Upload Resume<span className="ml-0.5 text-red-500">*</span>
              </label>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
                  errors.resume_url
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'
                }`}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleResumeUpload}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-gray-500">Uploading...</span>
                ) : resumeFileName ? (
                  <span className="text-green-700">{resumeFileName} (uploaded)</span>
                ) : (
                  <span className="text-gray-500">Drop your files here to upload</span>
                )}
              </label>
              {errors.resume_url && (
                <p className="mt-1 text-xs text-red-600">{errors.resume_url}</p>
              )}
            </div>

            {/* Terms */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-blue-700">Terms:</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
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
            />

            <Button type="submit" loading={submitting} className="w-full">
              Submit
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
