import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useUpload } from '@/hooks/useUpload';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

interface BasicProfile {
  permanent_address?: string;
  current_address?: string;
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

export default function BasicProfileForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { uploadFile, uploading } = useUpload();
  const [activeSection, setActiveSection] = useState(0);
  const [form, setForm] = useState<BasicProfile>({});
  const [fullName, setFullName] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');

  const { data: profile, isLoading } = useQuery<BasicProfile | null>({
    queryKey: ['basicProfile'],
    queryFn: async () => {
      const { data } = await api.get('/talent/me/basic-profile');
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm(profile);
      if (profile.bank_account_number) {
        setConfirmAccountNumber(profile.bank_account_number);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
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
    mutationFn: async (data: { full_name: string }) => {
      const { data: result } = await api.put('/talent/me', data);
      return result;
    },
    onSuccess: () => {
      toast.success('Details updated successfully');
      // Reload to refresh AuthContext with the new name
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update details');
    },
  });

  const set = (key: keyof BasicProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const setNumber = (key: keyof BasicProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : undefined }));

  const toggleMulti = (key: 'availability' | 'job_type', value: string) => {
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

    // Section 0: Basic Details — update user name
    if (activeSection === 0) {
      if (!fullName.trim()) {
        toast.error('Full name is required');
        return;
      }
      saveUserMutation.mutate({ full_name: fullName.trim() });
      return;
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

  const sections = [
    'Basic Details',
    'Contact Details',
    'Job Preferences',
    'ID Proofs',
    'Profile Picture',
    'Bank Account',
    'Resume',
    'Expected Salary',
  ];

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
            key={section}
            onClick={() => setActiveSection(i)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeSection === i
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {section}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave}>
        {/* Section 1: Basic Details (from sign-up, read-only display + editable) */}
        {activeSection === 0 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Basic Details</h2>
            <p className="mb-4 text-sm text-gray-500">These details were collected during sign-up. You can update them here.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              <Input label="Email" value={user?.email || ''} disabled helperText="Email cannot be changed" />
            </div>
          </Card>
        )}

        {/* Section 2: Contact Details */}
        {activeSection === 1 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Contact Details</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Permanent Address</label>
                <textarea
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  value={form.permanent_address || ''}
                  onChange={set('permanent_address')}
                  placeholder="Your permanent address"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Current Address</label>
                <textarea
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  value={form.current_address || ''}
                  onChange={set('current_address')}
                  placeholder="Your current address"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Current District" value={form.current_district || ''} onChange={set('current_district')} placeholder="District" />
                <Input label="City" value={form.city || ''} onChange={set('city')} placeholder="City" />
                <Input label="PIN Code" value={form.pin_code || ''} onChange={set('pin_code')} placeholder="6-digit PIN" helperText="6-digit Indian PIN code" />
              </div>
            </div>
          </Card>
        )}

        {/* Section 3: Job Preferences */}
        {activeSection === 2 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Job Preferences</h2>
            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">Availability</h3>
                <div className="flex flex-wrap gap-3">
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={(form.availability || []).includes(opt.value)}
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

        {/* Section 4: ID Proofs */}
        {activeSection === 3 && (
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

        {/* Section 5: Profile Picture */}
        {activeSection === 4 && (
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

        {/* Section 6: Bank Account Details */}
        {activeSection === 5 && (
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

        {/* Section 7: Resume */}
        {activeSection === 6 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Resume</h2>
            <p className="mb-3 text-sm text-gray-500">Upload your resume in PDF format only.</p>
            <Button type="button" variant="outline" loading={uploading} onClick={() => handleFileUpload('resume_url', 'resumes', 'application/pdf')}>
              {form.resume_url ? 'Replace Resume' : 'Upload Resume (PDF)'}
            </Button>
            {form.resume_url && <p className="mt-2 text-xs text-green-600">Resume uploaded</p>}
          </Card>
        )}

        {/* Section 8: Expected Salary */}
        {activeSection === 7 && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Expected Salary</h2>
            <div className="max-w-xs">
              <Input
                label="Expected Salary per Month (₹)"
                type="number"
                value={form.expected_salary_monthly ?? ''}
                onChange={setNumber('expected_salary_monthly')}
                placeholder="e.g. 25000"
                min={0}
              />
            </div>
          </Card>
        )}

        {/* Navigation & Save */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={activeSection === 0}
            onClick={() => setActiveSection((p) => p - 1)}
          >
            Previous
          </Button>
          <div className="flex gap-3">
            <Button type="submit" loading={saveMutation.isPending || saveUserMutation.isPending}>
              Save Progress
            </Button>
            {activeSection < sections.length - 1 && (
              <Button type="button" variant="secondary" onClick={() => setActiveSection((p) => p + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
