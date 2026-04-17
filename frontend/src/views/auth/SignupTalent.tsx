'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useUpload } from '@/hooks/useUpload';
import api from '@/services/api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import {
  COUNTRIES,
  INDIAN_STATES,
  DISTRICTS_BY_STATE,
} from '@/constants/india-locations';
import toast from 'react-hot-toast';

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

const STEP_TITLES = [
  'Create Account',
  'Basic Details',
  'Contact Details',
  'Job Preferences',
  'ID Proofs',
  'Bank Details',
  'Profile Picture',
  'Resume',
];

const STEP_SUBTITLES = [
  'Showcase your skills and get discovered by businesses',
  'Help us understand who you are',
  'Where can we reach you?',
  'What kind of work are you looking for?',
  'Verify your identity',
  'Where should we send your payouts?',
  'Put a face to your profile',
  'Share your work history',
];

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

const TOTAL_STEPS = 8;

function signupDoneKey(userId: string) {
  return `squadhire_talent_signup_done_${userId}`;
}

function determineStartStep(me: TalentUser, bp: BasicProfile): number {
  if (!me.age || !me.gender || !me.native_place || !me.current_location) return 2;
  if (!bp.permanent_address && !bp.current_address && !bp.city && !bp.pin_code) return 3;
  if ((!bp.availability || bp.availability.length === 0) && (!bp.job_type || bp.job_type.length === 0)) return 4;
  if (!bp.aadhaar_number && !bp.pan_number) return 5;
  if (!bp.bank_account_holder && !bp.bank_account_number) return 6;
  if (!bp.profile_picture_url) return 7;
  if (!bp.resume_url) return 8;
  return 9;
}

export default function SignupTalent() {
  const { user, token, isLoading: authLoading, signupTalent } = useAuth();
  const router = useRouter();
  const { uploadFile, uploading } = useUpload();

  const [activeStep, setActiveStep] = useState(1);
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

  useEffect(() => {
    if (authLoading) return;

    if (!token || !user) {
      setActiveStep(1);
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
        const [meRes, profileRes] = await Promise.all([
          api.get<TalentUser>('/talent/me'),
          api.get<BasicProfile | null>('/talent/me/basic-profile'),
        ]);
        const me = meRes.data;
        const bp = profileRes.data || {};

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

        const startStep = determineStartStep(me, bp);
        if (startStep > TOTAL_STEPS) {
          localStorage.setItem(signupDoneKey(user.id), '1');
          router.push('/dashboard');
          return;
        }
        setActiveStep(startStep);
      } catch {
        setActiveStep(2);
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

  const goNext = () => {
    if (activeStep < TOTAL_STEPS) {
      setActiveStep(activeStep + 1);
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
    if (activeStep > 1) setActiveStep(activeStep - 1);
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
      setActiveStep(2);
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
    switch (activeStep) {
      case 1:
        return handleAccountSubmit();
      case 2:
        return handleBasicSubmit();
      case 3:
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
      case 4:
        return saveProfile({
          availability: profileForm.availability,
          job_type: profileForm.job_type,
        });
      case 5:
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
      case 6:
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
      case 7:
        return saveProfile({ profile_picture_url: profileForm.profile_picture_url });
      case 8:
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

  const isLastStep = activeStep === TOTAL_STEPS;
  const isSkippable = activeStep >= 3;
  const showFinishLater = activeStep >= 3;

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
                Step {activeStep} of {TOTAL_STEPS}
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
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < activeStep - 1
                      ? 'bg-indigo-600'
                      : i === activeStep - 1
                      ? 'bg-indigo-400'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {STEP_TITLES[activeStep - 1]}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{STEP_SUBTITLES[activeStep - 1]}</p>
          </div>

          {activeStep === 1 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">
                Signup is by invitation only. Use the email address your invitation was sent to.
              </p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {activeStep === 1 && (
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

            {activeStep === 2 && (
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

            {activeStep === 3 && (
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

            {activeStep === 4 && (
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

            {activeStep === 5 && (
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

            {activeStep === 6 && (
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

            {activeStep === 7 && (
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

            {activeStep === 8 && (
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
                disabled={activeStep === 1 || submitting}
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
                    {activeStep === 6 ? 'Skip for now' : 'Skip'}
                  </Button>
                )}
                <Button type="submit" loading={submitting}>
                  {activeStep === 1
                    ? 'Create Account'
                    : isLastStep
                    ? 'Finish'
                    : 'Save & Continue'}
                </Button>
              </div>
            </div>
          </form>

          {activeStep === 1 && (
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
