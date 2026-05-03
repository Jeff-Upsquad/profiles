import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useUpload } from '@/hooks/useUpload';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import VirtualOfficeHoursPicker, { type DayHours } from '@/components/forms/VirtualOfficeHoursPicker';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import toast from 'react-hot-toast';
import { COUNTRIES, INDIAN_STATES, DISTRICTS_BY_STATE } from '@/constants/india-locations';

interface BasicProfile {
  permanent_address?: string;
  permanent_country?: string;
  permanent_state?: string;
  permanent_district?: string;
  permanent_city?: string;
  permanent_pin_code?: string;
  current_address?: string;
  country?: string;
  state?: string;
  current_district?: string;
  city?: string;
  pin_code?: string;
  availability?: string[];
  job_type?: string[];
  employment_type?: string[];
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
  expected_salary_full_time?: number;
  expected_salary_part_time?: number;
  virtual_office_hours?: DayHours[];
}

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

const WORK_PREFERENCE_OPTIONS = [
  { label: "I'm looking for a job (Salary Based)", value: 'salary' },
  { label: 'Freelance work or the UpSquad Partner Program', value: 'freelance' },
];

interface SectionDef {
  name: string;
  description: string;
  tint: string;
  icon: ReactNode;
  disabled?: boolean;
}

function SectionHeader({ section }: { section: SectionDef }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div
        className={`${section.tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
        style={{ color: 'var(--tint-icon)' }}
      >
        {section.icon}
      </div>
      <div>
        <h2 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
          {section.name}
        </h2>
        <p className="mt-0.5 text-sm text-[#737373]">{section.description}</p>
      </div>
    </div>
  );
}

export default function BasicProfileForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { uploadFile, uploading } = useUpload();
  const [activeSection, setActiveSection] = useState(0);
  const [form, setForm] = useState<BasicProfile>({});
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const [currentSameAsOfficial, setCurrentSameAsOfficial] = useState(false);
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');

  const { data: profile, isLoading } = useQuery<BasicProfile | null>({
    queryKey: ['basicProfile'],
    queryFn: async () => {
      const { data } = await api.get('/talent/me/basic-profile');
      return data;
    },
  });

  const { data: talentUser } = useQuery<{ phone?: string; languages_spoken?: LanguageEntry[] } | null>({
    queryKey: ['talentMe'],
    queryFn: async () => {
      const { data } = await api.get('/talent/me');
      return data;
    },
  });

  useEffect(() => {
    if (talentUser?.languages_spoken) setLanguages(talentUser.languages_spoken);
    if (talentUser?.phone) setPhone(talentUser.phone);
  }, [talentUser]);

  useEffect(() => {
    if (profile) {
      setForm(profile);
      if (profile.bank_account_number) setConfirmAccountNumber(profile.bank_account_number);
      const hasAnyCurrent = !!(
        profile.current_address || profile.country || profile.state ||
        profile.current_district || profile.city || profile.pin_code
      );
      const hasAnyPermanent = !!(
        profile.permanent_address || profile.permanent_country || profile.permanent_state ||
        profile.permanent_district || profile.permanent_city || profile.permanent_pin_code
      );
      if (!hasAnyCurrent && hasAnyPermanent) setCurrentSameAsOfficial(true);
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      const parts = (user.full_name || '').trim().split(/\s+/);
      if (parts.length === 1) setFirstName(parts[0]);
      else if (parts.length === 2) { setFirstName(parts[0]); setLastName(parts[1]); }
      else if (parts.length >= 3) {
        setFirstName(parts[0]);
        setMiddleName(parts.slice(1, -1).join(' '));
        setLastName(parts[parts.length - 1]);
      }
      setPhone((user as any).phone || '');
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async (data: BasicProfile) => {
      const { data: result } = await api.put('/talent/me/basic-profile', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['basicProfile'] });
      toast.success('Profile saved successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save profile');
    },
  });

  const saveUserMutation = useMutation({
    mutationFn: async (data: { full_name?: string; languages_spoken?: LanguageEntry[] }) => {
      const { data: result } = await api.put('/talent/me', data);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talentMe'] });
      toast.success('Details updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update details');
    },
  });

  const set = (key: keyof BasicProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setNumber = (key: keyof BasicProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : undefined }));

  const toggleMulti = (key: 'availability' | 'job_type' | 'employment_type', value: string) => {
    setForm((prev) => {
      const arr = prev[key] || [];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const handleFileUpload = async (key: keyof BasicProfile, folder: string, accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const url = await uploadFile(file, folder);
        setForm((prev) => ({ ...prev, [key]: url }));
        toast.success('File uploaded');
      } catch {
        toast.error('Upload failed');
      }
    };
    input.click();
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    if (activeSection === 0) {
      if (!firstName.trim()) { toast.error('First name is required'); return; }
      const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');
      saveUserMutation.mutate({ full_name: fullName });
      if (form.employment_type) saveMutation.mutate({ employment_type: form.employment_type });
      return;
    }

    if (activeSection === 1) {
      if (languages.length === 0) { toast.error('Add at least one language'); return; }
      if (languages.some((l) => !l.language || !l.proficiency)) {
        toast.error('Complete language and proficiency for every entry'); return;
      }
      if (!languages.some((l) => l.proficiency === 'native')) {
        toast.error('Mark at least one language as Native (your mother tongue)'); return;
      }
      saveUserMutation.mutate({ languages_spoken: languages });
      return;
    }

    if (activeSection === 2) {
      const missingOfficial = !form.permanent_country || !form.permanent_state || !form.permanent_district || !form.permanent_city;
      if (missingOfficial) { toast.error('Country, state, district and city are required for official address'); return; }
      if (!currentSameAsOfficial) {
        const missingCurrent = !form.country || !form.state || !form.current_district || !form.city;
        if (missingCurrent) { toast.error('Country, state, district and city are required for current address'); return; }
      }
      if (form.permanent_pin_code && !/^\d{6}$/.test(form.permanent_pin_code)) {
        toast.error('Official PIN code must be 6 digits'); return;
      }
      if (currentSameAsOfficial) {
        saveMutation.mutate({
          ...form, current_address: null as any, country: null as any, state: null as any,
          current_district: null as any, city: null as any, pin_code: null as any,
        });
        return;
      }
    }

    if (form.pin_code && !/^\d{6}$/.test(form.pin_code)) { toast.error('PIN code must be 6 digits'); return; }
    if (form.aadhaar_number && !/^\d{12}$/.test(form.aadhaar_number)) { toast.error('Aadhaar number must be 12 digits'); return; }
    if (form.pan_number && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan_number)) { toast.error('Invalid PAN format (e.g. ABCDE1234F)'); return; }
    if (form.bank_account_number && form.bank_account_number !== confirmAccountNumber) { toast.error('Account numbers do not match'); return; }

    saveMutation.mutate(form);
  };

  const wantsSalary = (form.employment_type || []).includes('salary');
  const wantsFreelance = (form.employment_type || []).includes('freelance');

  // Per-section completion heuristics
  const completion = {
    0: !!firstName,
    1: languages.length > 0 && languages.some((l) => l.proficiency === 'native'),
    2: !!(form.permanent_country && form.permanent_state && form.permanent_district && form.permanent_city),
    3: (form.availability || []).length > 0 && (form.job_type || []).length > 0,
    4: (form.virtual_office_hours || []).length > 0,
    5: !!(form.aadhaar_number || form.pan_number),
    6: !!form.profile_picture_url,
    7: !!(form.bank_account_holder && form.bank_account_number && form.bank_ifsc_code),
    8: !!form.resume_url,
  };

  const sections: SectionDef[] = [
    {
      name: 'Basic Details',
      description: 'Your name, contact and work preference',
      tint: 'tint-purple',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    },
    {
      name: 'Language',
      description: 'Languages you speak fluently',
      tint: 'tint-blue',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>,
    },
    {
      name: 'Address',
      description: 'Your official and current locations',
      tint: 'tint-orange',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      name: 'Job Preference',
      description: 'Salary expectations and job type',
      tint: 'tint-green',
      disabled: !wantsSalary,
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    },
    {
      name: 'Freelance Preference',
      description: 'Virtual office hours and availability',
      tint: 'tint-pink',
      disabled: !wantsFreelance,
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      name: 'ID Proofs',
      description: 'Aadhaar and PAN card details',
      tint: 'tint-amber',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    },
    {
      name: 'Profile Picture',
      description: 'A clear photo for your profile',
      tint: 'tint-purple',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
    {
      name: 'Bank Account',
      description: 'Where we send your payments',
      tint: 'tint-blue',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    },
    {
      name: 'Resume',
      description: 'Upload your resume in PDF format',
      tint: 'tint-orange',
      icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    },
  ];

  const goToSection = (delta: 1 | -1) => {
    let i = activeSection + delta;
    while (i >= 0 && i < sections.length && sections[i].disabled) i += delta;
    if (i >= 0 && i < sections.length) setActiveSection(i);
  };

  useEffect(() => {
    if (sections[activeSection]?.disabled) {
      const next = sections.findIndex((s) => !s.disabled);
      if (next !== -1) setActiveSection(next);
    }
  }, [wantsSalary, wantsFreelance, activeSection]);

  // Compute progress
  const enabledSections = sections.filter((s) => !s.disabled).length;
  const completedCount = sections.reduce((acc, _, i) => {
    if (sections[i].disabled) return acc;
    return acc + (completion[i as keyof typeof completion] ? 1 : 0);
  }, 0);
  const progressPct = enabledSections > 0 ? Math.round((completedCount / enabledSections) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Hero Section (compact) ── */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {completedCount} of {enabledSections} sections complete
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Complete your <span className="text-rainbow">profile</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              These details are shared across all your job profiles.
            </p>
          </div>

          {/* Progress ring (compact) */}
          <div className="stagger-4">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E8E5DE" strokeWidth="9" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#prog-grad)"
                  strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(progressPct / 100) * 264} 264`}
                  className="transition-all duration-700"
                />
                <defs>
                  <linearGradient id="prog-grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#FF8B47" />
                    <stop offset="50%" stopColor="#D24DFF" />
                    <stop offset="100%" stopColor="#5BB7FF" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                {progressPct}%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Layout: Sidebar Stepper + Form ── */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar Stepper */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-[#E8E5DE] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="mb-2 px-2 pt-1 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
              Sections
            </h3>
            <nav className="flex flex-col gap-0.5">
              {sections.map((section, i) => {
                const isActive = activeSection === i;
                const isComplete = completion[i as keyof typeof completion];
                return (
                  <button
                    key={section.name}
                    type="button"
                    onClick={() => !section.disabled && setActiveSection(i)}
                    disabled={section.disabled}
                    title={section.disabled ? 'Select the matching work preference to enable this section' : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${
                      section.disabled
                        ? 'cursor-not-allowed opacity-40'
                        : isActive
                          ? 'bg-[#F7F6F3] shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]'
                          : 'hover:bg-[#F7F6F3]'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isComplete
                          ? 'bg-emerald-50 text-emerald-600'
                          : isActive
                            ? `${section.tint}`
                            : 'bg-[#f0f0f0] text-[#a3a3a3] group-hover:bg-[#E8E5DE]'
                      }`}
                      style={isActive && !isComplete ? { color: 'var(--tint-icon)' } : undefined}
                    >
                      {isComplete ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="font-[family-name:var(--font-inter)] text-xs font-semibold">
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-[family-name:var(--font-inter)] text-[13px] font-semibold truncate ${
                        isActive ? 'text-[#0a0a0a]' : 'text-[#525252]'
                      }`}>
                        {section.name}
                      </p>
                      <p className="font-[family-name:var(--font-inter)] text-[11px] text-[#a3a3a3] truncate">
                        {section.disabled ? 'Locked' : isComplete ? 'Complete' : 'Not started'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Form Content */}
        <form onSubmit={handleSave} className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-[#E8E5DE] bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] section-rise" key={activeSection}>
            <SectionHeader section={sections[activeSection]} />

            {/* Section 1: Basic Details */}
            {activeSection === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-3 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Personal Details</h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                    <Input label="Middle Name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name (optional)" />
                    <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Input label="Email" value={user?.email || ''} disabled helperText="Email cannot be changed" />
                    <Input label="Phone Number" value={phone} disabled helperText="Phone number cannot be changed" />
                  </div>
                </div>

                <div className="border-t border-[#E8E5DE] pt-6">
                  <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Work Preference</h3>
                  <p className="mb-3 mt-0.5 text-sm text-[#737373]">What type of work are you looking for? You can select both.</p>
                  <div className="flex flex-col gap-2.5">
                    {WORK_PREFERENCE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-[#E8E5DE] px-4 py-3 text-sm transition-all duration-200 has-[:checked]:border-[#0a0a0a] has-[:checked]:bg-[#F2FCBC] hover:border-[#a3a3a3] has-[:checked]:hover:border-[#0a0a0a]">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[#E8E5DE] text-[#0a0a0a] focus:ring-[#0a0a0a]/30"
                          checked={(form.employment_type || []).includes(opt.value as 'salary' | 'freelance')}
                          onChange={() => toggleMulti('employment_type' as any, opt.value)}
                        />
                        <span className="font-[family-name:var(--font-inter)] text-[14px] font-medium text-[#0a0a0a]">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Language */}
            {activeSection === 1 && (
              <div>
                <LanguagePicker value={languages} onChange={setLanguages} />
              </div>
            )}

            {/* Section 3: Address */}
            {activeSection === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-1 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Official Address</h3>
                  <p className="mb-4 text-sm text-[#737373]">As shown on your ID proofs (Aadhaar, PAN, etc.).</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">Address</label>
                      <textarea
                        className="block w-full rounded-lg border border-[#E8E5DE] bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12 transition-all duration-200"
                        rows={3} value={form.permanent_address || ''} onChange={set('permanent_address')} placeholder="Address line"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label="Country" required options={COUNTRIES} value={form.permanent_country || ''}
                        onChange={(e) => setForm((prev) => ({ ...prev, permanent_country: e.target.value, permanent_state: '', permanent_district: '' }))}
                      />
                      {form.permanent_country === 'India' ? (
                        <Select label="State" required placeholder="Select state" options={INDIAN_STATES} value={form.permanent_state || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, permanent_state: e.target.value, permanent_district: '' }))}
                        />
                      ) : (
                        <Input label="State / Region" required value={form.permanent_state || ''} onChange={set('permanent_state')} placeholder="State or region" />
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {form.permanent_country === 'India' && form.permanent_state ? (
                        <Select label="District" required placeholder="Select district"
                          options={(DISTRICTS_BY_STATE[form.permanent_state] || []).map((d) => ({ label: d, value: d }))}
                          value={form.permanent_district || ''} onChange={set('permanent_district')}
                        />
                      ) : (
                        <Input label="District" required value={form.permanent_district || ''} onChange={set('permanent_district')}
                          placeholder={form.permanent_country === 'India' ? 'Select a state first' : 'District'}
                          disabled={form.permanent_country === 'India' && !form.permanent_state}
                        />
                      )}
                      <Input label="City" required value={form.permanent_city || ''} onChange={set('permanent_city')} placeholder="City" />
                      <Input label="PIN Code" value={form.permanent_pin_code || ''} onChange={set('permanent_pin_code')} placeholder="6-digit PIN" helperText="6-digit Indian PIN code" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#E8E5DE] pt-6">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Current Address</h3>
                    <label className="flex cursor-pointer items-center gap-2 font-[family-name:var(--font-inter)] text-[13px] text-[#525252]">
                      <input
                        type="checkbox" className="h-4 w-4 rounded border-[#E8E5DE] text-[#0a0a0a] focus:ring-[#0a0a0a]/30"
                        checked={currentSameAsOfficial}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCurrentSameAsOfficial(checked);
                          if (checked) {
                            setForm((prev) => ({ ...prev, current_address: '', country: '', state: '', current_district: '', city: '', pin_code: '' }));
                          }
                        }}
                      />
                      Same as official address
                    </label>
                  </div>
                  <div className="mb-4 flex items-start gap-3 rounded-xl bg-[#FDF6E7] p-4">
                    <svg className="h-5 w-5 flex-shrink-0 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-[#92400E]">
                      Your current address matters — some brands prefer people from particular areas or near their office.
                    </p>
                  </div>
                  {!currentSameAsOfficial && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">Address</label>
                        <textarea
                          className="block w-full rounded-lg border border-[#E8E5DE] bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12 transition-all duration-200"
                          rows={3} value={form.current_address || ''} onChange={set('current_address')} placeholder="Your current address"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Country" required options={COUNTRIES} value={form.country || ''}
                          onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value, state: '', current_district: '' }))}
                        />
                        {form.country === 'India' ? (
                          <Select label="State" required placeholder="Select state" options={INDIAN_STATES} value={form.state || ''}
                            onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value, current_district: '' }))}
                          />
                        ) : (
                          <Input label="State / Region" required value={form.state || ''} onChange={set('state')} placeholder="State or region" />
                        )}
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        {form.country === 'India' && form.state ? (
                          <Select label="District" required placeholder="Select district"
                            options={(DISTRICTS_BY_STATE[form.state] || []).map((d) => ({ label: d, value: d }))}
                            value={form.current_district || ''} onChange={set('current_district')}
                          />
                        ) : (
                          <Input label="District" required value={form.current_district || ''} onChange={set('current_district')}
                            placeholder={form.country === 'India' ? 'Select a state first' : 'District'}
                            disabled={form.country === 'India' && !form.state}
                          />
                        )}
                        <Input label="City" required value={form.city || ''} onChange={set('city')} placeholder="City" />
                        <Input label="PIN Code" value={form.pin_code || ''} onChange={set('pin_code')} placeholder="6-digit PIN" helperText="6-digit Indian PIN code" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Job Preference */}
            {activeSection === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Availability</h3>
                  <div className="space-y-2.5">
                    {AVAILABILITY_OPTIONS.map((opt) => {
                      const checked = (form.availability || []).includes(opt.value);
                      const salaryKey = opt.value === 'full_time' ? 'expected_salary_full_time' : 'expected_salary_part_time';
                      return (
                        <div key={opt.value} className="rounded-xl border border-[#E8E5DE] px-4 py-3 transition-all duration-200 has-[:checked]:border-[#0a0a0a] has-[:checked]:bg-[#F2FCBC]">
                          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                            <input type="checkbox" className="h-4 w-4 rounded border-[#E8E5DE] text-[#0a0a0a] focus:ring-[#0a0a0a]/30"
                              checked={checked} onChange={() => toggleMulti('availability', opt.value)}
                            />
                            <span className="font-[family-name:var(--font-inter)] font-medium text-[#0a0a0a]">{opt.label}</span>
                          </label>
                          {checked && (
                            <div className="mt-3 max-w-xs">
                              <Input label="Expected Monthly Salary (₹)" type="number"
                                value={form[salaryKey] ?? ''} onChange={setNumber(salaryKey)} placeholder="e.g. 25000" min={0}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Job Type</h3>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {JOB_TYPE_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#E8E5DE] px-4 py-3 text-sm transition-all duration-200 has-[:checked]:border-[#0a0a0a] has-[:checked]:bg-[#F2FCBC]">
                        <input type="checkbox" className="h-4 w-4 rounded border-[#E8E5DE] text-[#0a0a0a] focus:ring-[#0a0a0a]/30"
                          checked={(form.job_type || []).includes(opt.value)} onChange={() => toggleMulti('job_type', opt.value)}
                        />
                        <span className="font-[family-name:var(--font-inter)] font-medium text-[#0a0a0a]">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section 5: Freelance Preference */}
            {activeSection === 4 && (
              <VirtualOfficeHoursPicker
                value={form.virtual_office_hours || []}
                onChange={(next) => setForm((prev) => ({ ...prev, virtual_office_hours: next }))}
              />
            )}

            {/* Section 6: ID Proofs */}
            {activeSection === 5 && (
              <div className="space-y-6">
                <div className="rounded-xl border border-[#E8E5DE] bg-[#F7F6F3] p-5">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="tint-amber flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: 'var(--tint-icon)' }}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Aadhaar Card</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Aadhaar Number" value={form.aadhaar_number || ''} onChange={set('aadhaar_number')} placeholder="12-digit Aadhaar number" helperText="12-digit number" />
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">Aadhaar Card Copy</label>
                      <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => handleFileUpload('aadhaar_file_url', 'aadhaar', 'image/*,.pdf')}>
                        {form.aadhaar_file_url ? 'Replace File' : 'Upload File'}
                      </Button>
                      {form.aadhaar_file_url && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          File uploaded
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-[#E8E5DE] bg-[#F7F6F3] p-5">
                  <div className="mb-4 flex items-center gap-2.5">
                    <div className="tint-amber flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: 'var(--tint-icon)' }}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">PAN Card</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="PAN Number" value={form.pan_number || ''} onChange={set('pan_number')} placeholder="e.g. ABCDE1234F" helperText="5 letters, 4 digits, 1 letter" />
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]">PAN Card Copy</label>
                      <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => handleFileUpload('pan_file_url', 'pan', 'image/*,.pdf')}>
                        {form.pan_file_url ? 'Replace File' : 'Upload File'}
                      </Button>
                      {form.pan_file_url && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          File uploaded
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7: Profile Picture */}
            {activeSection === 6 && (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <div className="relative">
                  {form.profile_picture_url ? (
                    <>
                      <img src={form.profile_picture_url} alt="Profile" className="h-32 w-32 rounded-2xl object-cover ring-1 ring-[#E8E5DE]" />
                      <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-white">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-[#F2FCBC]">
                      <svg className="h-12 w-12 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Upload your photo</h3>
                  <p className="mt-1 text-sm text-[#737373]">A clear, professional headshot helps brands recognize you. JPEG or PNG only.</p>
                  <div className="mt-4">
                    <Button type="button" variant="outline" loading={uploading} onClick={() => handleFileUpload('profile_picture_url', 'profile-pictures', 'image/jpeg,image/png')}>
                      {form.profile_picture_url ? 'Change Photo' : 'Upload Photo'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 8: Bank Account */}
            {activeSection === 7 && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-[#FDF6E7] p-4">
                  <svg className="h-5 w-5 flex-shrink-0 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-sm text-[#92400E]">All payments will be transferred to this bank account. Verify carefully.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Account Holder Name" value={form.bank_account_holder || ''} onChange={set('bank_account_holder')} placeholder="As per bank records" />
                  <Input label="Bank Name" value={form.bank_name || ''} onChange={set('bank_name')} placeholder="Bank name" />
                  <Input label="Account Number" value={form.bank_account_number || ''} onChange={set('bank_account_number')} placeholder="Account number" />
                  <Input label="Confirm Account Number" value={confirmAccountNumber} onChange={(e) => setConfirmAccountNumber(e.target.value)} placeholder="Re-enter account number" error={confirmAccountNumber && form.bank_account_number !== confirmAccountNumber ? 'Account numbers do not match' : undefined} />
                  <Input label="IFSC Code" value={form.bank_ifsc_code || ''} onChange={set('bank_ifsc_code')} placeholder="IFSC code" />
                  <Input label="Branch Name" value={form.bank_branch_name || ''} onChange={set('bank_branch_name')} placeholder="Branch name" />
                </div>
              </div>
            )}

            {/* Section 9: Resume */}
            {activeSection === 8 && (
              <div>
                <div className="rounded-xl border-2 border-dashed border-[#E8E5DE] bg-[#F7F6F3] p-10 text-center transition-colors hover:border-[#0a0a0a]/50 hover:bg-[#F2FCBC]/30">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                    <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
                    {form.resume_url ? 'Replace your resume' : 'Upload your resume'}
                  </h3>
                  <p className="mt-1 text-sm text-[#737373]">PDF format only. Max 10MB.</p>
                  <div className="mt-4 inline-flex">
                    <Button type="button" variant="outline" loading={uploading} onClick={() => handleFileUpload('resume_url', 'resumes', 'application/pdf')}>
                      {form.resume_url ? 'Replace Resume' : 'Choose PDF'}
                    </Button>
                  </div>
                  {form.resume_url && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Resume uploaded
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Sticky Action Bar ── */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-[#E8E5DE] bg-white/95 backdrop-blur-md p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]">
            <Button type="button" variant="ghost" disabled={activeSection === 0} onClick={() => goToSection(-1)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </Button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saveMutation.isPending || saveUserMutation.isPending}
                className="btn-iridescent disabled:opacity-50"
              >
                {saveMutation.isPending || saveUserMutation.isPending ? 'Saving…' : 'Save Progress'}
              </button>
              {activeSection < sections.length - 1 && (
                <Button type="button" variant="secondary" onClick={() => goToSection(1)}>
                  Next
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
