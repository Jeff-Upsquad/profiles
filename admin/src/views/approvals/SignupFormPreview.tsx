'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import ChipSelect from '@/components/ui/ChipSelect';
import LanguagePickerPreview from './preview/LanguagePickerPreview';
import VirtualOfficeHoursPreview from './preview/VirtualOfficeHoursPreview';
import EducationPickerPreview from './preview/EducationPickerPreview';

type EmploymentType = 'salary' | 'freelance';

type StepId =
  | 'account'
  | 'basic'
  | 'contact'
  | 'employment'
  | 'job_pref'
  | 'education'
  | 'virtual_hours'
  | 'id'
  | 'bank'
  | 'photo'
  | 'resume';

const STEP_META: Record<StepId, { title: string; subtitle: string; description?: string }> = {
  account: {
    title: 'Create Account',
    subtitle: 'Showcase your skills and get discovered by businesses',
  },
  basic: {
    title: 'Basic Details',
    subtitle: 'Help us understand who you are',
  },
  contact: {
    title: 'Contact Details',
    subtitle: 'Where can we reach you?',
  },
  employment: {
    title: 'What kind of work are you looking for?',
    subtitle: 'Pick at least one — you can choose both if you’re open to either.',
  },
  job_pref: {
    title: 'Job Preferences',
    subtitle: 'Tell us about your salary-based work preferences',
    description:
      'If you are also looking for employment (monthly salary basis), which of these options do you prefer?',
  },
  education: {
    title: 'Education & Courses',
    subtitle: 'Share your educational background and any courses or training you have completed',
  },
  virtual_hours: {
    title: 'Set your virtual office times',
    subtitle:
      'Enter your days and times of availability. These times will be shown in your profile and represent when you are available for work.',
  },
  id: {
    title: 'ID Proofs',
    subtitle: 'Verify your identity',
  },
  bank: {
    title: 'Bank Details',
    subtitle: 'Where should we send your payouts?',
  },
  photo: {
    title: 'Profile Picture',
    subtitle: 'Put a face to your profile',
  },
  resume: {
    title: 'Resume',
    subtitle: 'Share your work history',
  },
};

const AVAILABILITY_OPTIONS = [
  { label: 'Full Time', value: 'full_time' },
  { label: 'Part Time', value: 'part_time' },
];

const JOB_TYPE_OPTIONS = [
  { label: 'Remote Job', value: 'remote' },
  { label: 'Office Job', value: 'office' },
  { label: 'Hybrid Job (mix of office and remote)', value: 'hybrid' },
  { label: 'Field Job', value: 'field' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { label: 'Looking for employment (monthly salary-based work)', value: 'salary' },
  { label: 'Freelance work / UpSquad Partner Program', value: 'freelance' },
];

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

function buildVisibleSteps(employmentType: EmploymentType[]): StepId[] {
  const middle: StepId[] = [];
  if (employmentType.includes('salary')) middle.push('job_pref');
  middle.push('education');
  if (employmentType.includes('freelance')) middle.push('virtual_hours');
  return [
    'account',
    'basic',
    'contact',
    'employment',
    ...middle,
    'id',
    'bank',
    'photo',
    'resume',
  ];
}

function PreviewButton({
  children,
  variant = 'primary',
  disabled,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-full px-5 py-2.5 text-sm transition-all';
  const styles = {
    primary: 'bg-neutral-900 text-white hover:bg-neutral-800',
    outline: 'border border-neutral-300 bg-transparent text-neutral-900 hover:bg-neutral-50',
    ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

export default function SignupFormPreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [employmentType, setEmploymentType] = useState<EmploymentType[]>([
    'salary',
    'freelance',
  ]);

  const visibleSteps = useMemo(
    () => buildVisibleSteps(employmentType),
    [employmentType]
  );

  const clampedIndex = Math.min(activeIndex, visibleSteps.length - 1);
  const currentStepId = visibleSteps[clampedIndex];
  const totalSteps = visibleSteps.length;
  const meta = STEP_META[currentStepId];
  const isLastStep = clampedIndex === totalSteps - 1;
  const isSkippable =
    currentStepId !== 'account' &&
    currentStepId !== 'basic' &&
    currentStepId !== 'employment';

  const goNext = () => {
    if (clampedIndex < visibleSteps.length - 1) {
      setActiveIndex(clampedIndex + 1);
    }
  };

  const goBack = () => {
    if (clampedIndex > 0) {
      setActiveIndex(clampedIndex - 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin header */}
      <div>
        <Link
          href="/approvals"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          &larr; Back to Approvals
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          Signup Form Preview
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          This is a live preview of the talent signup form. Use the buttons below to
          navigate between steps.
        </p>
      </div>

      {/* Simulated talent view */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-12">
        <div className="mx-auto w-full max-w-2xl">
          {/* Logo */}
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
                S
              </span>
              <span className="text-2xl font-bold text-gray-900">UpSquad</span>
            </span>
          </div>

          <Card className="p-6 sm:p-8">
            {/* Step indicator + progress bar */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                  Step {clampedIndex + 1} of {totalSteps}
                </span>
                {isSkippable && (
                  <span className="text-xs font-medium text-gray-500">
                    I&apos;ll finish this later &rarr;
                  </span>
                )}
              </div>
              <div className="mb-4 flex gap-1">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < clampedIndex
                        ? 'bg-indigo-600'
                        : i === clampedIndex
                        ? 'bg-indigo-400'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{meta.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{meta.subtitle}</p>
              {meta.description && (
                <p className="mt-2 text-sm text-gray-600">{meta.description}</p>
              )}
            </div>

            {/* Step content */}
            <div className="space-y-4">
              {currentStepId === 'account' && (
                <>
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                      Signup is by invitation only. Use the email address your
                      invitation was sent to.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Full Name"
                      placeholder="Your full name"
                      disabled
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      disabled
                      required
                    />
                  </div>
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    disabled
                    required
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    disabled
                  />
                </>
              )}

              {currentStepId === 'basic' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Age"
                      type="number"
                      placeholder="25"
                      disabled
                    />
                    <Select
                      label="Gender"
                      placeholder="Select gender"
                      options={GENDER_OPTIONS}
                      disabled
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Native Place"
                      placeholder="Your hometown"
                      disabled
                    />
                    <Input
                      label="Current Location"
                      placeholder="City, State"
                      disabled
                    />
                  </div>
                  <LanguagePickerPreview />
                </>
              )}

              {currentStepId === 'contact' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Permanent Address
                    </label>
                    <textarea
                      disabled
                      rows={3}
                      placeholder="Your permanent address"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Current Address
                    </label>
                    <textarea
                      disabled
                      rows={3}
                      placeholder="Your current address"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 disabled:opacity-60"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Select
                      label="Country"
                      options={[{ label: 'India', value: 'India' }]}
                      disabled
                    />
                    <Select
                      label="State"
                      placeholder="Select state"
                      options={[]}
                      disabled
                    />
                    <Select
                      label="District"
                      placeholder="Select district"
                      options={[]}
                      disabled
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="City" placeholder="City" disabled />
                    <Input
                      label="PIN Code"
                      placeholder="6-digit PIN"
                      helperText="6-digit Indian PIN code"
                      disabled
                    />
                  </div>
                </>
              )}

              {currentStepId === 'employment' && (
                <ChipSelect
                  multi
                  options={EMPLOYMENT_TYPE_OPTIONS}
                  selected={employmentType}
                  onChange={(val) => {
                    const next = (Array.isArray(val) ? val : [val]) as EmploymentType[];
                    setEmploymentType(next);
                  }}
                  required
                />
              )}

              {currentStepId === 'job_pref' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      Availability
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm opacity-60"
                        >
                          <input
                            type="checkbox"
                            disabled
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      Job Type
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {JOB_TYPE_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm opacity-60"
                        >
                          <input
                            type="checkbox"
                            disabled
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStepId === 'education' && <EducationPickerPreview />}

              {currentStepId === 'virtual_hours' && <VirtualOfficeHoursPreview />}

              {currentStepId === 'id' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">
                      Aadhaar Card
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Aadhaar Number"
                        placeholder="12-digit Aadhaar number"
                        helperText="12-digit number"
                        disabled
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Aadhaar Card Copy
                        </label>
                        <PreviewButton variant="outline" disabled>
                          Upload File
                        </PreviewButton>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">
                      PAN Card
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="PAN Number"
                        placeholder="e.g. ABCDE1234F"
                        helperText="5 letters, 4 digits, 1 letter"
                        disabled
                      />
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          PAN Card Copy
                        </label>
                        <PreviewButton variant="outline" disabled>
                          Upload File
                        </PreviewButton>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStepId === 'bank' && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                    <p className="mb-1 font-semibold text-blue-900">
                      Why we ask for this
                    </p>
                    <p className="text-blue-800">
                      Your bank details are used only to pay you for jobs you take
                      on through UpSquad. We store them securely and never share
                      them.
                    </p>
                    <p className="mt-2 text-blue-800">
                      <span className="font-medium">You can share this later</span>{' '}
                      &mdash; skip for now and add it anytime from your profile.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Account Holder Name"
                      placeholder="As per bank records"
                      disabled
                    />
                    <Input
                      label="Bank Name"
                      placeholder="Bank name"
                      disabled
                    />
                    <Input
                      label="Account Number"
                      placeholder="Account number"
                      disabled
                    />
                    <Input
                      label="Confirm Account Number"
                      placeholder="Re-enter account number"
                      disabled
                    />
                    <Input
                      label="IFSC Code"
                      placeholder="IFSC code"
                      disabled
                    />
                    <Input
                      label="Branch Name"
                      placeholder="Branch name"
                      disabled
                    />
                  </div>
                </div>
              )}

              {currentStepId === 'photo' && (
                <div className="flex items-center gap-6">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                    <svg
                      className="h-10 w-10 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <PreviewButton variant="outline" disabled>
                    Upload Photo
                  </PreviewButton>
                </div>
              )}

              {currentStepId === 'resume' && (
                <div>
                  <p className="mb-3 text-sm text-gray-500">
                    Upload your resume in PDF format only.
                  </p>
                  <PreviewButton variant="outline" disabled>
                    Upload Resume (PDF)
                  </PreviewButton>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <PreviewButton
                variant="outline"
                disabled={clampedIndex === 0}
                onClick={goBack}
              >
                Back
              </PreviewButton>
              <div className="flex gap-3">
                {isSkippable && (
                  <PreviewButton variant="ghost" onClick={goNext}>
                    {currentStepId === 'bank' ? 'Skip for now' : 'Skip'}
                  </PreviewButton>
                )}
                <PreviewButton
                  onClick={isLastStep ? undefined : goNext}
                  disabled={isLastStep}
                >
                  {currentStepId === 'account'
                    ? 'Create Account'
                    : isLastStep
                    ? 'Finish'
                    : 'Save & Continue'}
                </PreviewButton>
              </div>
            </div>

            {/* Account step links */}
            {currentStepId === 'account' && (
              <>
                <div className="mt-6 text-center text-sm text-gray-500">
                  Already have an account?{' '}
                  <span className="font-medium text-indigo-600">Sign in</span>
                </div>
                <div className="mt-2 text-center text-sm text-gray-500">
                  Are you a business?{' '}
                  <span className="font-medium text-indigo-600">
                    Sign up as Business
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
