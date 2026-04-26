'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUpload } from '@/hooks/useUpload';
import api from '@/services/api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ChipSelect from '@/components/ui/ChipSelect';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import VirtualOfficeHoursPicker, {
  type DayHours,
} from '@/components/forms/VirtualOfficeHoursPicker';
import {
  COUNTRIES,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
} from '@/constants/india-locations';
import toast from 'react-hot-toast';

type EmploymentType = 'salary' | 'freelance';

interface BasicProfile {
  permanent_address?: string;
  current_address?: string;
  country?: string;
  state?: string;
  current_district?: string;
  city?: string;
  pin_code?: string;
  availability?: string[];
  job_type?: string[];
  employment_type?: EmploymentType[];
  virtual_office_hours?: DayHours[];
  aadhaar_number?: string;
  aadhaar_file_url?: string;
  pan_number?: string;
  pan_file_url?: string;
  profile_picture_url?: string;
  bank_account_holder?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc_code?: string;
  bank_branch_name?: string;
  resume_url?: string;
  expected_salary_monthly?: number;
}

interface TalentUser {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  age?: number;
  gender?: string;
  native_place?: string;
  current_location?: string;
  languages_spoken?: LanguageEntry[];
}

interface LeadSubmission {
  id: string;
  form_type: string;
  form_data: Record<string, any> | null;
  created_at: string;
}

type StepId =
  | 'account'
  | 'basic'
  | 'contact'
  | 'employment'
  | 'job_pref'
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

function buildVisibleSteps(employmentType: EmploymentType[] | undefined): StepId[] {
  const types = employmentType ?? [];
  const middle: StepId[] = [];
  if (types.includes('salary')) middle.push('job_pref');
  if (types.includes('freelance')) middle.push('virtual_hours');
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

function inferEmploymentTypeFromLead(lead: LeadSubmission | null): EmploymentType[] {
  if (!lead) return [];
  const explicit = lead.form_data?.looking_for;
  if (Array.isArray(explicit)) {
    const valid = explicit.filter(
      (v): v is EmploymentType => v === 'salary' || v === 'freelance'
    );
    if (valid.length) return valid;
  }
  if (lead.form_type === 'creative') return ['freelance'];
  if (lead.form_type === 'accountant') return ['salary'];
  return [];
}

function signupDoneKey(userId: string) {
  return `squadhire_talent_signup_done_${userId}`;
}

function determineStartStepId(me: TalentUser, bp: BasicProfile): StepId | null {
  if (!me.age || !me.gender || !me.native_place || !me.current_location) return 'basic';
  if (!bp.permanent_address && !bp.current_address && !bp.city && !bp.pin_code) return 'contact';
  if (!bp.employment_type || bp.employment_type.length === 0) return 'employment';
  if (
    bp.employment_type.includes('salary') &&
    (!bp.availability || bp.availability.length === 0) &&
    (!bp.job_type || bp.job_type.length === 0)
  )
    return 'job_pref';
  if (
    bp.employment_type.includes('freelance') &&
    (!bp.virtual_office_hours || bp.virtual_office_hours.length === 0)
  )
    return 'virtual_hours';
  if (!bp.aadhaar_number && !bp.pan_number) return 'id';
  if (!bp.bank_account_holder && !bp.bank_account_number) return 'bank';
  if (!bp.profile_picture_url) return 'photo';
  if (!bp.resume_url) return 'resume';
  return null;
}

export default function SignupTalent() {
  const { user, token, isLoading: authLoading, signupTalent } = useAuth();
  const router = useRouter();
  const { uploadFile, uploading } = useUpload();

  const [activeIndex, setActiveIndex] = useState(0);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [accountForm, setAccountForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
  });

  const [basicForm, setBasicForm] = useState({
    age: '',
    gender: '',
    native_place: '',
    current_location: '',
  });
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);

  const [profileForm, setProfileForm] = useState<BasicProfile>({});
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');

  const visibleSteps = useMemo(
    () => buildVisibleSteps(profileForm.employment_type),
    [profileForm.employment_type]
  );
  const currentStepId: StepId = visibleSteps[Math.min(activeIndex, visibleSteps.length - 1)];
  const totalSteps = visibleSteps.length;
  const meta = STEP_META[currentStepId];

  useEffect(() => {
    if (authLoading) return;

    if (!token || !user) {
      setActiveIndex(0);
      setInitializing(false);
      return;
    }

    if (user.role !== 'talent') {
      router.push('/dashboard');
      return;
    }

    if (typeof window !== 'undefined' && localStorage.getItem(signupDoneKey(user.id))) {
      router.push('/dashboard');
      return;
    }

    (async () => {
      try {
        const [meRes, profileRes, leadRes] = await Promise.all([
          api.get<TalentUser>('/talent/me'),
          api.get<BasicProfile | null>('/talent/me/basic-profile'),
          api.get<LeadSubmission | null>('/talent/me/lead-submission').catch(() => null),
        ]);
        const me = meRes.data;
        const bp = profileRes.data || {};

        // Auto-populate employment_type from prior public-form lead, if not yet saved.
        if (!bp.employment_type || bp.employment_type.length === 0) {
          const inferred = inferEmploymentTypeFromLead(leadRes?.data ?? null);
          if (inferred.length) bp.employment_type = inferred;
        }

        setAccountForm({
          email: me.email || '',
          password: '',
          full_name: me.full_name || '',
          phone: me.phone || '',
        });
        setBasicForm({
          age: me.age ? String(me.age) : '',
          gender: me.gender || '',
          native_place: me.native_place || '',
          current_location: me.current_location || '',
        });
        setLanguages(me.languages_spoken || []);
        setProfileForm(bp);
        if (bp.bank_account_number) setConfirmAccountNumber(bp.bank_account_number);

        const startId = determineStartStepId(me, bp);
        if (!startId) {
          localStorage.setItem(signupDoneKey(user.id), '1');
          router.push('/dashboard');
          return;
        }
        const steps = buildVisibleSteps(bp.employment_type);
        setActiveIndex(Math.max(0, steps.indexOf(startId)));
      } catch {
        setActiveIndex(1);
      } finally {
        setInitializing(false);
      }
    })();
  }, [authLoading, token, user, router]);

  const setAccount = (key: keyof typeof accountForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setAccountForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setBasic = (key: keyof typeof basicForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setBasicForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setProfile = (key: keyof BasicProfile) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setProfileForm((prev) => ({ ...prev, [key]: e.target.value }));

  const toggleMulti = (key: 'availability' | 'job_type', value: string) => {
    setProfileForm((prev) => {
      const arr = prev[key] || [];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const handleFileUpload = async (
    key: keyof BasicProfile,
    folder: string,
    accept: string
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await uploadFile(file, folder);
        setProfileForm((prev) => ({ ...prev, [key]: url }));
        toast.success('File uploaded');
      } catch {
        toast.error('Upload failed');
      }
    };
    input.click();
  };

  // Note: visibleSteps recomputes when employment_type changes, so the
  // next-step lookup naturally accounts for added/removed branches. We do
  // NOT clear job_pref or virtual_hours data when a branch is unselected —
  // it stays in the DB silently and reappears if the user re-selects.
  const goNext = () => {
    if (activeIndex < visibleSteps.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    if (user?.id) {
      localStorage.setItem(signupDoneKey(user.id), '1');
    }
    router.push('/dashboard');
  };

  const handleBack = () => {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  };

  const handleAccountSubmit = async () => {
    if (!accountForm.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!accountForm.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (accountForm.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await signupTalent(
        {
          email: accountForm.email.trim(),
          password: accountForm.password,
          full_name: accountForm.full_name.trim(),
          phone: accountForm.phone.trim() || undefined,
        },
        { skipRedirect: true }
      );
      toast.success('Account created');
      const stepsAfter = buildVisibleSteps(profileForm.employment_type);
      setActiveIndex(stepsAfter.indexOf('basic'));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBasicSubmit = async () => {
    const filledLanguages = languages.filter((l) => l.language);
    setSubmitting(true);
    try {
      await api.put('/talent/me', {
        age: basicForm.age ? Number(basicForm.age) : undefined,
        gender: basicForm.gender || undefined,
        native_place: basicForm.native_place.trim() || undefined,
        current_location: basicForm.current_location.trim() || undefined,
        languages_spoken: filledLanguages.length > 0 ? filledLanguages : undefined,
      });
      toast.success('Saved');
      goNext();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfile = async (patch: BasicProfile) => {
    setSubmitting(true);
    try {
      await api.put('/talent/me/basic-profile', patch);
      toast.success('Saved');
      goNext();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    switch (currentStepId) {
      case 'account':
        return handleAccountSubmit();
      case 'basic':
        return handleBasicSubmit();
      case 'contact':
        if (profileForm.pin_code && !/^\d{6}$/.test(profileForm.pin_code)) {
          toast.error('PIN code must be 6 digits');
          return;
        }
        return saveProfile({
          permanent_address: profileForm.permanent_address,
          current_address: profileForm.current_address,
          country: profileForm.country || 'India',
          state: profileForm.state,
          current_district: profileForm.current_district,
          city: profileForm.city,
          pin_code: profileForm.pin_code,
        });
      case 'employment':
        if (!profileForm.employment_type || profileForm.employment_type.length === 0) {
          toast.error('Pick at least one option');
          return;
        }
        return saveProfile({ employment_type: profileForm.employment_type });
      case 'job_pref':
        return saveProfile({
          availability: profileForm.availability,
          job_type: profileForm.job_type,
        });
      case 'virtual_hours':
        return saveProfile({ virtual_office_hours: profileForm.virtual_office_hours });
      case 'id':
        if (profileForm.aadhaar_number && !/^\d{12}$/.test(profileForm.aadhaar_number)) {
          toast.error('Aadhaar number must be 12 digits');
          return;
        }
        if (
          profileForm.pan_number &&
          !/^[A-Z]{5}\d{4}[A-Z]$/.test(profileForm.pan_number)
        ) {
          toast.error('Invalid PAN format (e.g. ABCDE1234F)');
          return;
        }
        return saveProfile({
          aadhaar_number: profileForm.aadhaar_number,
          aadhaar_file_url: profileForm.aadhaar_file_url,
          pan_number: profileForm.pan_number,
          pan_file_url: profileForm.pan_file_url,
        });
      case 'bank':
        if (
          profileForm.bank_account_number &&
          profileForm.bank_account_number !== confirmAccountNumber
        ) {
          toast.error('Account numbers do not match');
          return;
        }
        return saveProfile({
          bank_account_holder: profileForm.bank_account_holder,
          bank_name: profileForm.bank_name,
          bank_account_number: profileForm.bank_account_number,
          bank_ifsc_code: profileForm.bank_ifsc_code,
          bank_branch_name: profileForm.bank_branch_name,
        });
      case 'photo':
        return saveProfile({ profile_picture_url: profileForm.profile_picture_url });
      case 'resume':
        return saveProfile({ resume_url: profileForm.resume_url });
    }
  };

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const isLastStep = activeIndex === visibleSteps.length - 1;
  const isSkippable =
    currentStepId !== 'account' &&
    currentStepId !== 'basic' &&
    currentStepId !== 'employment';
  const showFinishLater = isSkippable;

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
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                Step {activeIndex + 1} of {totalSteps}
              </span>
              {showFinishLater && (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="text-xs font-medium text-gray-500 hover:text-indigo-600"
                >
                  I'll finish this later →
                </button>
              )}
            </div>
            <div className="mb-4 flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < activeIndex
                      ? 'bg-indigo-600'
                      : i === activeIndex
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

          {currentStepId === 'account' && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Signup is by invitation only. Use the email address your invitation was sent to.
              </p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {currentStepId === 'account' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name"
                    value={accountForm.full_name}
                    onChange={setAccount('full_name')}
                    placeholder="Your full name"
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={accountForm.email}
                    onChange={setAccount('email')}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <Input
                  label="Password"
                  type="password"
                  value={accountForm.password}
                  onChange={setAccount('password')}
                  placeholder="Minimum 8 characters"
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={accountForm.phone}
                  onChange={setAccount('phone')}
                  placeholder="+91 XXXXX XXXXX"
                />
              </>
            )}

            {currentStepId === 'basic' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Age"
                    type="number"
                    value={basicForm.age}
                    onChange={setBasic('age')}
                    placeholder="25"
                  />
                  <Select
                    label="Gender"
                    value={basicForm.gender}
                    onChange={setBasic('gender')}
                    placeholder="Select gender"
                    options={[
                      { label: 'Male', value: 'male' },
                      { label: 'Female', value: 'female' },
                      { label: 'Other', value: 'other' },
                      { label: 'Prefer not to say', value: 'prefer_not_to_say' },
                    ]}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Native Place"
                    value={basicForm.native_place}
                    onChange={setBasic('native_place')}
                    placeholder="Your hometown"
                  />
                  <Input
                    label="Current Location"
                    value={basicForm.current_location}
                    onChange={setBasic('current_location')}
                    placeholder="City, State"
                  />
                </div>
                <LanguagePicker value={languages} onChange={setLanguages} />
              </>
            )}

            {currentStepId === 'contact' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Permanent Address
                  </label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    value={profileForm.permanent_address || ''}
                    onChange={setProfile('permanent_address')}
                    placeholder="Your permanent address"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Current Address
                  </label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    value={profileForm.current_address || ''}
                    onChange={setProfile('current_address')}
                    placeholder="Your current address"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Select
                    label="Country"
                    value={profileForm.country || 'India'}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        country: e.target.value,
                        state: undefined,
                        current_district: undefined,
                      }))
                    }
                    options={COUNTRIES}
                  />
                  {(profileForm.country || 'India') === 'India' ? (
                    <Select
                      label="State"
                      value={profileForm.state || ''}
                      onChange={(e) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          state: e.target.value,
                          current_district: undefined,
                        }))
                      }
                      placeholder="Select state"
                      options={INDIAN_STATES}
                    />
                  ) : (
                    <Input
                      label="State / Region"
                      value={profileForm.state || ''}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, state: e.target.value }))
                      }
                      placeholder="State or region"
                    />
                  )}
                  {(profileForm.country || 'India') === 'India' && profileForm.state ? (
                    <Select
                      label="District"
                      value={profileForm.current_district || ''}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, current_district: e.target.value }))
                      }
                      placeholder="Select district"
                      options={(DISTRICTS_BY_STATE[profileForm.state] || []).map((d) => ({
                        label: d,
                        value: d,
                      }))}
                    />
                  ) : (
                    <Input
                      label="District"
                      value={profileForm.current_district || ''}
                      onChange={setProfile('current_district')}
                      placeholder={
                        (profileForm.country || 'India') === 'India'
                          ? 'Select a state first'
                          : 'District'
                      }
                      disabled={
                        (profileForm.country || 'India') === 'India' && !profileForm.state
                      }
                    />
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="City"
                    value={profileForm.city || ''}
                    onChange={setProfile('city')}
                    placeholder="City"
                  />
                  <Input
                    label="PIN Code"
                    value={profileForm.pin_code || ''}
                    onChange={setProfile('pin_code')}
                    placeholder="6-digit PIN"
                    helperText="6-digit Indian PIN code"
                  />
                </div>
              </>
            )}

            {currentStepId === 'employment' && (
              <ChipSelect
                multi
                options={EMPLOYMENT_TYPE_OPTIONS}
                selected={profileForm.employment_type || []}
                onChange={(val) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    employment_type: (Array.isArray(val) ? val : [val]) as EmploymentType[],
                  }))
                }
                required
              />
            )}

            {currentStepId === 'job_pref' && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-700">Availability</h3>
                  <div className="flex flex-wrap gap-3">
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={(profileForm.availability || []).includes(opt.value)}
                          onChange={() => toggleMulti('availability', opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-700">Job Type</h3>
                  <div className="flex flex-wrap gap-3">
                    {JOB_TYPE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={(profileForm.job_type || []).includes(opt.value)}
                          onChange={() => toggleMulti('job_type', opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStepId === 'virtual_hours' && (
              <VirtualOfficeHoursPicker
                value={profileForm.virtual_office_hours || []}
                onChange={(next) =>
                  setProfileForm((prev) => ({ ...prev, virtual_office_hours: next }))
                }
              />
            )}

            {currentStepId === 'id' && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-800">Aadhaar Card</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Aadhaar Number"
                      value={profileForm.aadhaar_number || ''}
                      onChange={setProfile('aadhaar_number')}
                      placeholder="12-digit Aadhaar number"
                      helperText="12-digit number"
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Aadhaar Card Copy
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading}
                        onClick={() =>
                          handleFileUpload('aadhaar_file_url', 'aadhaar', 'image/*,.pdf')
                        }
                      >
                        {profileForm.aadhaar_file_url ? 'Replace File' : 'Upload File'}
                      </Button>
                      {profileForm.aadhaar_file_url && (
                        <p className="mt-1 text-xs text-green-600">File uploaded</p>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-800">PAN Card</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="PAN Number"
                      value={profileForm.pan_number || ''}
                      onChange={setProfile('pan_number')}
                      placeholder="e.g. ABCDE1234F"
                      helperText="5 letters, 4 digits, 1 letter"
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        PAN Card Copy
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={uploading}
                        onClick={() =>
                          handleFileUpload('pan_file_url', 'pan', 'image/*,.pdf')
                        }
                      >
                        {profileForm.pan_file_url ? 'Replace File' : 'Upload File'}
                      </Button>
                      {profileForm.pan_file_url && (
                        <p className="mt-1 text-xs text-green-600">File uploaded</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStepId === 'bank' && (
              <div className="space-y-5">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                  <p className="mb-1 font-semibold text-blue-900">Why we ask for this</p>
                  <p className="text-blue-800">
                    Your bank details are used only to pay you for jobs you take on through
                    UpSquad. We store them securely and never share them.
                  </p>
                  <p className="mt-2 text-blue-800">
                    <span className="font-medium">You can share this later</span> — skip for
                    now and add it anytime from your profile.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Account Holder Name"
                    value={profileForm.bank_account_holder || ''}
                    onChange={setProfile('bank_account_holder')}
                    placeholder="As per bank records"
                  />
                  <Input
                    label="Bank Name"
                    value={profileForm.bank_name || ''}
                    onChange={setProfile('bank_name')}
                    placeholder="Bank name"
                  />
                  <Input
                    label="Account Number"
                    value={profileForm.bank_account_number || ''}
                    onChange={setProfile('bank_account_number')}
                    placeholder="Account number"
                  />
                  <Input
                    label="Confirm Account Number"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    placeholder="Re-enter account number"
                    error={
                      confirmAccountNumber &&
                      profileForm.bank_account_number !== confirmAccountNumber
                        ? 'Account numbers do not match'
                        : undefined
                    }
                  />
                  <Input
                    label="IFSC Code"
                    value={profileForm.bank_ifsc_code || ''}
                    onChange={setProfile('bank_ifsc_code')}
                    placeholder="IFSC code"
                  />
                  <Input
                    label="Branch Name"
                    value={profileForm.bank_branch_name || ''}
                    onChange={setProfile('bank_branch_name')}
                    placeholder="Branch name"
                  />
                </div>
              </div>
            )}

            {currentStepId === 'photo' && (
              <div className="flex items-center gap-6">
                {profileForm.profile_picture_url ? (
                  <img
                    src={profileForm.profile_picture_url}
                    alt="Profile"
                    className="h-24 w-24 rounded-full border-2 border-gray-200 object-cover"
                  />
                ) : (
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
                )}
                <Button
                  type="button"
                  variant="outline"
                  loading={uploading}
                  onClick={() =>
                    handleFileUpload(
                      'profile_picture_url',
                      'profile-pictures',
                      'image/jpeg,image/png'
                    )
                  }
                >
                  {profileForm.profile_picture_url ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>
            )}

            {currentStepId === 'resume' && (
              <div>
                <p className="mb-3 text-sm text-gray-500">
                  Upload your resume in PDF format only.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  loading={uploading}
                  onClick={() => handleFileUpload('resume_url', 'resumes', 'application/pdf')}
                >
                  {profileForm.resume_url ? 'Replace Resume' : 'Upload Resume (PDF)'}
                </Button>
                {profileForm.resume_url && (
                  <p className="mt-2 text-xs text-green-600">Resume uploaded</p>
                )}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                disabled={activeIndex === 0 || submitting}
                onClick={handleBack}
              >
                Back
              </Button>
              <div className="flex gap-3">
                {isSkippable && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={goNext}
                  >
                    {currentStepId === 'bank' ? 'Skip for now' : 'Skip'}
                  </Button>
                )}
                <Button type="submit" loading={submitting}>
                  {currentStepId === 'account'
                    ? 'Create Account'
                    : isLastStep
                    ? 'Finish'
                    : 'Save & Continue'}
                </Button>
              </div>
            </div>
          </form>

          {currentStepId === 'account' && (
            <>
              <div className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link
                  href="/login/talent"
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
