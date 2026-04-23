'use client';

import Link from 'next/link';
import Input from '@/components/ui/Input';

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

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

function StepCard({
  step,
  title,
  subtitle,
  children,
  note,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  note?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-indigo-600">
          Step {step} of 8
        </span>
        <h2 className="mt-3 text-xl font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </div>
      {note}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function DisabledTextarea({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        disabled
        rows={3}
        placeholder={placeholder}
        className="block w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400"
      />
    </div>
  );
}

function DisabledSelect({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder: string;
  options?: { label: string; value: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        disabled
        className="block w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-400 shadow-sm"
      >
        <option>{placeholder}</option>
        {options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DisabledCheckboxGroup({
  heading,
  options,
}: {
  heading: string;
  options: { label: string; value: string }[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-gray-700">{heading}</h3>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600"
          >
            <input
              type="checkbox"
              disabled
              className="h-4 w-4 cursor-not-allowed rounded border-gray-300"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function DisabledUpload({ label, accept }: { label: string; accept: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-500 opacity-60"
        >
          Upload File
        </button>
        <span className="text-xs text-gray-400">Accepts: {accept}</span>
      </div>
    </div>
  );
}

export default function SignupFormPreview() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/approvals"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            ← Back to Approvals
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Signup Form Preview</h1>
          <p className="mt-1 text-sm text-gray-500">
            This is the empty 8-step form talents fill out when signing up. All fields
            are shown read-only for reference.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <StepCard
          step={1}
          title="Create Account"
          subtitle="Showcase your skills and get discovered by businesses"
          note={
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Signup is by invitation only. Talents use the email their invitation was
                sent to.
              </p>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Name" placeholder="Your full name" disabled />
            <Input label="Email" type="email" placeholder="you@example.com" disabled />
          </div>
          <Input
            label="Password"
            type="password"
            placeholder="Minimum 8 characters"
            disabled
          />
          <Input label="Phone" type="tel" placeholder="+91 XXXXX XXXXX" disabled />
        </StepCard>

        <StepCard
          step={2}
          title="Basic Details"
          subtitle="Help us understand who you are"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Age" type="number" placeholder="25" disabled />
            <DisabledSelect
              label="Gender"
              placeholder="Select gender"
              options={GENDER_OPTIONS}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Native Place" placeholder="Your hometown" disabled />
            <Input label="Current Location" placeholder="City, State" disabled />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Languages Spoken
            </label>
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
              Language picker — talents add each language they speak along with a
              proficiency level (Basic, Conversational, Fluent, Native).
            </div>
          </div>
        </StepCard>

        <StepCard
          step={3}
          title="Contact Details"
          subtitle="Where can we reach you?"
        >
          <DisabledTextarea label="Permanent Address" placeholder="Your permanent address" />
          <DisabledTextarea label="Current Address" placeholder="Your current address" />
          <div className="grid gap-4 sm:grid-cols-3">
            <DisabledSelect label="Country" placeholder="India" />
            <DisabledSelect label="State" placeholder="Select state" />
            <DisabledSelect label="District" placeholder="Select district" />
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
        </StepCard>

        <StepCard
          step={4}
          title="Job Preferences"
          subtitle="What kind of work are you looking for?"
        >
          <DisabledCheckboxGroup heading="Availability" options={AVAILABILITY_OPTIONS} />
          <DisabledCheckboxGroup heading="Job Type" options={JOB_TYPE_OPTIONS} />
        </StepCard>

        <StepCard step={5} title="ID Proofs" subtitle="Verify your identity">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Aadhaar Card</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Aadhaar Number"
                placeholder="12-digit Aadhaar number"
                helperText="12-digit number"
                disabled
              />
              <DisabledUpload label="Aadhaar Card Copy" accept="image, PDF" />
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-800">PAN Card</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="PAN Number"
                placeholder="e.g. ABCDE1234F"
                helperText="5 letters, 4 digits, 1 letter"
                disabled
              />
              <DisabledUpload label="PAN Card Copy" accept="image, PDF" />
            </div>
          </div>
        </StepCard>

        <StepCard
          step={6}
          title="Bank Details"
          subtitle="Where should we send your payouts?"
          note={
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <p className="font-semibold text-blue-900">Why we ask for this</p>
              <p className="mt-1 text-blue-800">
                Bank details are used only to pay talents for jobs taken through UpSquad.
                Stored securely, never shared. Talents may skip and add it later from
                their profile.
              </p>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Account Holder Name"
              placeholder="As per bank records"
              disabled
            />
            <Input label="Bank Name" placeholder="Bank name" disabled />
            <Input label="Account Number" placeholder="Account number" disabled />
            <Input
              label="Confirm Account Number"
              placeholder="Re-enter account number"
              disabled
            />
            <Input label="IFSC Code" placeholder="IFSC" disabled />
            <Input label="Branch Name" placeholder="Branch" disabled />
          </div>
        </StepCard>

        <StepCard
          step={7}
          title="Profile Picture"
          subtitle="Put a face to your profile"
        >
          <DisabledUpload label="Profile Picture" accept="image" />
        </StepCard>

        <StepCard step={8} title="Resume" subtitle="Share your work history">
          <DisabledUpload label="Resume" accept="PDF, DOC" />
        </StepCard>
      </div>

      <div className="pt-2">
        <Link
          href="/approvals"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          ← Back to Approvals
        </Link>
      </div>
    </div>
  );
}
