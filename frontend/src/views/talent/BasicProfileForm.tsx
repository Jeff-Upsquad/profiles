import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useUpload } from '@/hooks/useUpload';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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
    if (talentUser?.languages_spoken) {
      setLanguages(talentUser.languages_spoken);
    }
    if (talentUser?.phone) {
      setPhone(talentUser.phone);
    }
  }, [talentUser]);

  useEffect(() => {
    if (profile) {
      setForm(profile);
      if (profile.bank_account_number) {
        setConfirmAccountNumber(profile.bank_account_number);
      }
      const hasAnyCurrent = !!(
        profile.current_address ||
        profile.country ||
        profile.state ||
        profile.current_district ||
        profile.city ||
        profile.pin_code
      );
      const hasAnyPermanent = !!(
        profile.permanent_address ||
        profile.permanent_country ||
        profile.permanent_state ||
        profile.permanent_district ||
        profile.permanent_city ||
        profile.permanent_pin_code
      );
      if (!hasAnyCurrent && hasAnyPermanent) {
        setCurrentSameAsOfficial(true);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      const parts = (user.full_name || '').trim().split(/\s+/);
      if (parts.length === 1) {
        setFirstName(parts[0]);
      } else if (parts.length === 2) {
        setFirstName(parts[0]);
        setLastName(parts[1]);
      } else if (parts.length >= 3) {
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

    // Section 0: Basic Details — update user name, phone, and work preference
    if (activeSection === 0) {
      if (!firstName.trim()) {
        toast.error('First name is required');
        return;
      }
      const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(' ');
      saveUserMutation.mutate({ full_name: fullName });
      if (form.employment_type) {
        saveMutation.mutate({ employment_type: form.employment_type });
      }
      return;
    }

    // Section 1: Language — at least one entry, all complete, at least one native
    if (activeSection === 1) {
      if (languages.length === 0) {
        toast.error('Add at least one language');
        return;
      }
      if (languages.some((l) => !l.language || !l.proficiency)) {
        toast.error('Complete language and proficiency for every entry');
        return;
      }
      if (!languages.some((l) => l.proficiency === 'native')) {
        toast.error('Mark at least one language as Native (your mother tongue)');
        return;
      }
      saveUserMutation.mutate({ languages_spoken: languages });
      return;
    }

    // Section 2: Address — country, state, district, city required
    if (activeSection === 2) {
      const missingOfficial = !form.permanent_country || !form.permanent_state || !form.permanent_district || !form.permanent_city;
      if (missingOfficial) {
        toast.error('Country, state, district and city are required for official address');
        return;
      }
      if (!currentSameAsOfficial) {
        const missingCurrent = !form.country || !form.state || !form.current_district || !form.city;
        if (missingCurrent) {
          toast.error('Country, state, district and city are required for current address');
          return;
        }
      }
      if (form.permanent_pin_code && !/^\d{6}$/.test(form.permanent_pin_code)) {
        toast.error('Official PIN code must be 6 digits');
        return;
      }
      // Clear current address fields when same-as-official is on
      if (currentSameAsOfficial) {
        saveMutation.mutate({
          ...form,
          current_address: null as any,
          country: null as any,
          state: null as any,
          current_district: null as any,
          city: null as any,
          pin_code: null as any,
        });
        return;
      }
    }

    if (form.pin_code && !/^\d{6}$/.test(form.pin_code)) {
      toast.error('PIN code must be 6 digits');
      return;
    }
    if (form.aadhaar_number && !/^\d{12}$/.test(form.aadhaar_number)) {
      toast.error('Aadhaar number must be 12 digits');
      return;
    }
    if (form.pan_number && !/^[A-Z]{5}\d{4}[A-Z]$/.test(form.pan_number)) {
      toast.error('Invalid PAN format (e.g. ABCDE1234F)');
      return;
    }
    if (form.bank_account_number && form.bank_account_number !== confirmAccountNumber) {
      toast.error('Account numbers do not match');
      return;
    }

    saveMutation.mutate(form);
  };

  const wantsSalary = (form.employment_type || []).includes('salary');
  const wantsFreelance = (form.employment_type || []).includes('freelance');
  const sections = [
    { name: 'Basic Details', disabled: false },
    { name: 'Language', disabled: false },
    { name: 'Address', disabled: false },
    { name: 'Job Preference', disabled: !wantsSalary },
    { name: 'Freelance Preference', disabled: !wantsFreelance },
    { name: 'ID Proofs', disabled: false },
    { name: 'Profile Picture', disabled: false },
    { name: 'Bank Account', disabled: false },
    { name: 'Resume', disabled: false },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Fill in your details to get started</p>
      </div>

      {/* Section Navigation */}
      <div className="flex flex-wrap gap-2">
        {sections.map((section, i) => (
          <button
            key={section.name}
            type="button"
            onClick={() => !section.disabled && setActiveSection(i)}
            disabled={section.disabled}
            title={section.disabled ? 'Select the matching work preference to enable this section' : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              section.disabled
                ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                : activeSection === i
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {section.name}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {/* Section 1: Basic Details */}
        {activeSection === 0 && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Personal Details</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                <Input label="Middle Name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name (optional)" />
                <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input label="Email" value={user?.email || ''} disabled helperText="Email cannot be changed" />
                <Input label="Phone Number" value={phone} disabled helperText="Phone number cannot be changed" />
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Work Preference</h2>
              <p className="mb-3 text-sm text-gray-500">What type of work are you looking for? You can select both.</p>
              <div className="flex flex-col gap-3">
                {WORK_PREFERENCE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={(form.employment_type || []).includes(opt.value as 'salary' | 'freelance')}
                      onChange={() => toggleMulti('employment_type' as any, opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Section 2: Language */}
        {activeSection === 1 && (
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Language</h2>
            <p className="mb-4 text-sm text-gray-500">Add the languages you speak. At least one must be marked as Native (your mother tongue).</p>
            <LanguagePicker value={languages} onChange={setLanguages} />
          </Card>
        )}

        {/* Section 3: Address */}
        {activeSection === 2 && (
          <div className="space-y-6">
            <Card>
              <h2 className="mb-1 text-lg font-semibold text-gray-900">Official Address</h2>
              <p className="mb-4 text-sm text-gray-500">As shown on your ID proofs (Aadhaar, PAN, etc.).</p>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    rows={3}
                    value={form.permanent_address || ''}
                    onChange={set('permanent_address')}
                    placeholder="Address line"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Country"
                    required
                    options={COUNTRIES}
                    value={form.permanent_country || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        permanent_country: e.target.value,
                        permanent_state: '',
                        permanent_district: '',
                      }))
                    }
                  />
                  {form.permanent_country === 'India' ? (
                    <Select
                      label="State"
                      required
                      placeholder="Select state"
                      options={INDIAN_STATES}
                      value={form.permanent_state || ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          permanent_state: e.target.value,
                          permanent_district: '',
                        }))
                      }
                    />
                  ) : (
                    <Input
                      label="State / Region"
                      required
                      value={form.permanent_state || ''}
                      onChange={set('permanent_state')}
                      placeholder="State or region"
                    />
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {form.permanent_country === 'India' && form.permanent_state ? (
                    <Select
                      label="District"
                      required
                      placeholder="Select district"
                      options={(DISTRICTS_BY_STATE[form.permanent_state] || []).map((d) => ({ label: d, value: d }))}
                      value={form.permanent_district || ''}
                      onChange={set('permanent_district')}
                    />
                  ) : (
                    <Input
                      label="District"
                      required
                      value={form.permanent_district || ''}
                      onChange={set('permanent_district')}
                      placeholder={form.permanent_country === 'India' ? 'Select a state first' : 'District'}
                      disabled={form.permanent_country === 'India' && !form.permanent_state}
                    />
                  )}
                  <Input label="City" required value={form.permanent_city || ''} onChange={set('permanent_city')} placeholder="City" />
                  <Input label="PIN Code" value={form.permanent_pin_code || ''} onChange={set('permanent_pin_code')} placeholder="6-digit PIN" helperText="6-digit Indian PIN code" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-900">Current Address</h2>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={currentSameAsOfficial}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCurrentSameAsOfficial(checked);
                      if (checked) {
                        setForm((prev) => ({
                          ...prev,
                          current_address: '',
                          country: '',
                          state: '',
                          current_district: '',
                          city: '',
                          pin_code: '',
                        }));
                      }
                    }}
                  />
                  Same as official address
                </label>
              </div>
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Your current address matters — some brands prefer people from particular areas or near their office. Fill this section based on where you are currently staying.
              </div>
              {!currentSameAsOfficial && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                      value={form.current_address || ''}
                      onChange={set('current_address')}
                      placeholder="Your current address"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Country"
                      required
                      options={COUNTRIES}
                      value={form.country || ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          country: e.target.value,
                          state: '',
                          current_district: '',
                        }))
                      }
                    />
                    {form.country === 'India' ? (
                      <Select
                        label="State"
                        required
                        placeholder="Select state"
                        options={INDIAN_STATES}
                        value={form.state || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            state: e.target.value,
                            current_district: '',
                          }))
                        }
                      />
                    ) : (
                      <Input
                        label="State / Region"
                        required
                        value={form.state || ''}
                        onChange={set('state')}
                        placeholder="State or region"
                      />
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {form.country === 'India' && form.state ? (
                      <Select
                        label="District"
                        required
                        placeholder="Select district"
                        options={(DISTRICTS_BY_STATE[form.state] || []).map((d) => ({ label: d, value: d }))}
                        value={form.current_district || ''}
                        onChange={set('current_district')}
                      />
                    ) : (
                      <Input
                        label="District"
                        required
                        value={form.current_district || ''}
                        onChange={set('current_district')}
                        placeholder={form.country === 'India' ? 'Select a state first' : 'District'}
                        disabled={form.country === 'India' && !form.state}
                      />
                    )}
                    <Input label="City" required value={form.city || ''} onChange={set('city')} placeholder="City" />
                    <Input label="PIN Code" value={form.pin_code || ''} onChange={set('pin_code')} placeholder="6-digit PIN" helperText="6-digit Indian PIN code" />
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Section 4: Job Preference (gated by employment_type=salary) */}
        {activeSection === 3 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Job Preference</h2>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">Availability</h3>
                <div className="space-y-3">
                  {AVAILABILITY_OPTIONS.map((opt) => {
                    const checked = (form.availability || []).includes(opt.value);
                    const salaryKey = opt.value === 'full_time' ? 'expected_salary_full_time' : 'expected_salary_part_time';
                    return (
                      <div key={opt.value} className="rounded-lg border border-gray-200 px-4 py-3 transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            checked={checked}
                            onChange={() => toggleMulti('availability', opt.value)}
                          />
                          {opt.label}
                        </label>
                        {checked && (
                          <div className="mt-3 max-w-xs">
                            <Input
                              label="Expected Monthly Salary (₹)"
                              type="number"
                              value={form[salaryKey] ?? ''}
                              onChange={setNumber(salaryKey)}
                              placeholder="e.g. 25000"
                              min={0}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">Job Type</h3>
                <div className="flex flex-wrap gap-3">
                  {JOB_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={(form.job_type || []).includes(opt.value)}
                        onChange={() => toggleMulti('job_type', opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Section 5: Freelance Preference (gated by employment_type=freelance) */}
        {activeSection === 4 && (
          <Card>
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Freelance Preference</h2>
            <p className="mb-4 text-sm text-gray-500">When are you available for freelance work? Set your virtual office hours.</p>
            <VirtualOfficeHoursPicker
              value={form.virtual_office_hours || []}
              onChange={(next) => setForm((prev) => ({ ...prev, virtual_office_hours: next }))}
            />
          </Card>
        )}

        {/* Section 6: ID Proofs */}
        {activeSection === 5 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">ID Proofs</h2>
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Aadhaar Card</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Aadhaar Number" value={form.aadhaar_number || ''} onChange={set('aadhaar_number')} placeholder="12-digit Aadhaar number" helperText="12-digit number" />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Aadhaar Card Copy</label>
                    <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => handleFileUpload('aadhaar_file_url', 'aadhaar', 'image/*,.pdf')}>
                      {form.aadhaar_file_url ? 'Replace File' : 'Upload File'}
                    </Button>
                    {form.aadhaar_file_url && <p className="mt-1 text-xs text-green-600">File uploaded</p>}
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">PAN Card</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="PAN Number" value={form.pan_number || ''} onChange={set('pan_number')} placeholder="e.g. ABCDE1234F" helperText="5 letters, 4 digits, 1 letter" />
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">PAN Card Copy</label>
                    <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => handleFileUpload('pan_file_url', 'pan', 'image/*,.pdf')}>
                      {form.pan_file_url ? 'Replace File' : 'Upload File'}
                    </Button>
                    {form.pan_file_url && <p className="mt-1 text-xs text-green-600">File uploaded</p>}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Section 7: Profile Picture */}
        {activeSection === 6 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Picture</h2>
            <div className="flex items-center gap-6">
              {form.profile_picture_url ? (
                <img src={form.profile_picture_url} alt="Profile" className="h-24 w-24 rounded-full object-cover border-2 border-gray-200" />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <Button type="button" variant="outline" loading={uploading} onClick={() => handleFileUpload('profile_picture_url', 'profile-pictures', 'image/jpeg,image/png')}>
                {form.profile_picture_url ? 'Change Photo' : 'Upload Photo'}
              </Button>
            </div>
          </Card>
        )}

        {/* Section 8: Bank Account Details */}
        {activeSection === 7 && (
          <Card>
            <h2 className="mb-2 text-lg font-semibold text-gray-900">Bank Account Details</h2>
            <p className="mb-4 text-sm text-amber-600">All payments will be transferred to this bank account.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Account Holder Name" value={form.bank_account_holder || ''} onChange={set('bank_account_holder')} placeholder="As per bank records" />
              <Input label="Bank Name" value={form.bank_name || ''} onChange={set('bank_name')} placeholder="Bank name" />
              <Input label="Account Number" value={form.bank_account_number || ''} onChange={set('bank_account_number')} placeholder="Account number" />
              <Input label="Confirm Account Number" value={confirmAccountNumber} onChange={(e) => setConfirmAccountNumber(e.target.value)} placeholder="Re-enter account number" error={confirmAccountNumber && form.bank_account_number !== confirmAccountNumber ? 'Account numbers do not match' : undefined} />
              <Input label="IFSC Code" value={form.bank_ifsc_code || ''} onChange={set('bank_ifsc_code')} placeholder="IFSC code" />
              <Input label="Branch Name" value={form.bank_branch_name || ''} onChange={set('bank_branch_name')} placeholder="Branch name" />
            </div>
          </Card>
        )}

        {/* Section 9: Resume */}
        {activeSection === 8 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Resume</h2>
            <p className="mb-3 text-sm text-gray-500">Upload your resume in PDF format only.</p>
            <Button type="button" variant="outline" loading={uploading} onClick={() => handleFileUpload('resume_url', 'resumes', 'application/pdf')}>
              {form.resume_url ? 'Replace Resume' : 'Upload Resume (PDF)'}
            </Button>
            {form.resume_url && <p className="mt-2 text-xs text-green-600">Resume uploaded</p>}
          </Card>
        )}

        {/* Navigation & Save */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={activeSection === 0}
            onClick={() => goToSection(-1)}
          >
            Previous
          </Button>
          <div className="flex gap-3">
            <Button type="submit" loading={saveMutation.isPending || saveUserMutation.isPending}>
              Save Progress
            </Button>
            {activeSection < sections.length - 1 && (
              <Button type="button" variant="secondary" onClick={() => goToSection(1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
