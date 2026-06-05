'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import AdminSkillsAndTools from '@/components/forms/AdminSkillsAndTools';
import AdminPortfolioEditor from '@/components/forms/AdminPortfolioEditor';
import { coerceLeveledList, type LeveledItem } from '../../../../shared/src/types/talent';
import {
  useUpdateTalentUser,
  useUpdateTalentProfile,
} from '@/hooks/useAdminTalentEdit';
import type { CategoryField } from '@/types';

interface ProfileData {
  id: string;
  category_id: string;
  status: string;
  is_active: boolean;
  field_data: Record<string, any>;
  resume_url?: string | null;
  talent_user_id: string;
  talent_users?: {
    id: string;
    full_name: string;
    phone: string | null;
    age: number | null;
    gender: string | null;
    current_location: string | null;
    native_place: string | null;
    languages_spoken: LanguageEntry[] | null;
    profile_photo_url?: string | null;
  };
  categories?: { name: string; slug: string };
}

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending_review: 'yellow',
  rejected: 'red',
  draft: 'gray',
  inactive: 'gray',
};

export default function TalentProfileEditView({
  categoryId,
  profileId,
}: {
  categoryId: string;
  profileId: string;
}) {
  const router = useRouter();

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['talent-profile', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talents/profiles/${profileId}`);
      return data.profile ?? data;
    },
    enabled: !!profileId,
  });

  const { data: fields = [] } = useQuery<CategoryField[]>({
    queryKey: ['category-fields', profile?.category_id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${profile!.category_id}/fields`);
      return data.fields ?? data;
    },
    enabled: !!profile?.category_id,
  });

  const [userValues, setUserValues] = useState({
    full_name: '',
    phone: '',
    age: '' as number | '',
    gender: '' as '' | 'male' | 'female' | 'other' | 'prefer_not_to_say',
    current_location: '',
    native_place: '',
    languages_spoken: [] as LanguageEntry[],
  });
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const initialUser = useRef<string>('');
  const initialFields = useRef<string>('');
  const initialResume = useRef<string>('');
  const initialized = useRef(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile || initialized.current) return;
    const tu = profile.talent_users;
    const u = {
      full_name: tu?.full_name ?? '',
      phone: tu?.phone ?? '',
      age: (tu?.age ?? '') as number | '',
      gender: (tu?.gender ?? '') as typeof userValues.gender,
      current_location: tu?.current_location ?? '',
      native_place: tu?.native_place ?? '',
      languages_spoken: tu?.languages_spoken ?? [],
    };
    setUserValues(u);
    setFieldValues(profile.field_data ?? {});
    setResumeUrl(profile.resume_url ?? '');
    initialUser.current = JSON.stringify(u);
    initialFields.current = JSON.stringify(profile.field_data ?? {});
    initialResume.current = profile.resume_url ?? '';
    initialized.current = true;
  }, [profile]);

  useEffect(() => {
    if (!initialized.current) return;
    const ud = JSON.stringify(userValues) !== initialUser.current;
    const fd = JSON.stringify(fieldValues) !== initialFields.current;
    const rd = resumeUrl !== initialResume.current;
    setDirty(ud || fd || rd);
  }, [userValues, fieldValues, resumeUrl]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const updateUser = useUpdateTalentUser(profile?.talent_user_id ?? '', profileId);
  const updateProfile = useUpdateTalentProfile(profileId);

  const handleSave = async () => {
    if (!profile) return;
    const userPayload: any = {
      full_name: userValues.full_name || undefined,
      phone: userValues.phone || undefined,
      age: userValues.age === '' ? null : userValues.age,
      gender: userValues.gender === '' ? null : userValues.gender,
      current_location: userValues.current_location || null,
      native_place: userValues.native_place || null,
      languages_spoken: (userValues.languages_spoken ?? []).filter((l) => l.language),
    };
    const profilePayload: any = {
      field_data: fieldValues,
      resume_url: resumeUrl || null,
    };
    try {
      await Promise.all([
        updateUser.mutateAsync(userPayload),
        updateProfile.mutateAsync(profilePayload),
      ]);
      initialUser.current = JSON.stringify(userValues);
      initialFields.current = JSON.stringify(fieldValues);
      initialResume.current = resumeUrl;
      setDirty(false);
      toast.success('Saved');
      router.push(`/talents/${categoryId}/${profileId}`);
    } catch {
      // toast handled by hook
    }
  };

  const handleCancel = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    router.push(`/talents/${categoryId}/${profileId}`);
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const skills: { skill: string; level: number }[] = fieldValues._skills ?? [];
  const tools: LeveledItem[] = coerceLeveledList(fieldValues._tools);
  const aiTools: LeveledItem[] = coerceLeveledList(fieldValues._ai_tools);

  const setField = (key: string, val: any) =>
    setFieldValues((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            onClick={handleCancel}
            className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
          >
            &larr; Back to profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit {profile.categories?.name} Profile
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{profile.talent_users?.full_name}</span>
            <Badge variant={statusVariant[profile.status] ?? 'gray'}>
              {profile.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={updateUser.isPending || updateProfile.isPending}
            disabled={!dirty}
          >
            Save Changes
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Admin edits do not change the profile&apos;s review status.
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Personal Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={userValues.full_name}
            onChange={(e) => setUserValues({ ...userValues, full_name: e.target.value })}
          />
          <Input
            label="Phone"
            value={userValues.phone}
            onChange={(e) => setUserValues({ ...userValues, phone: e.target.value })}
          />
          <Input
            label="Age"
            type="number"
            value={userValues.age}
            onChange={(e) =>
              setUserValues({ ...userValues, age: e.target.value === '' ? '' : Number(e.target.value) })
            }
          />
          <div className="w-full">
            <label className="mb-1 block text-sm font-medium text-gray-700">Gender</label>
            <select
              value={userValues.gender}
              onChange={(e) =>
                setUserValues({
                  ...userValues,
                  gender: e.target.value as typeof userValues.gender,
                })
              }
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <Input
            label="Current Location"
            value={userValues.current_location}
            onChange={(e) =>
              setUserValues({ ...userValues, current_location: e.target.value })
            }
          />
          <Input
            label="Native Place"
            value={userValues.native_place}
            onChange={(e) =>
              setUserValues({ ...userValues, native_place: e.target.value })
            }
          />
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <LanguagePicker
            value={userValues.languages_spoken}
            onChange={(langs) =>
              setUserValues({ ...userValues, languages_spoken: langs })
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {profile.categories?.name} Profile Details
        </h2>
        <DynamicFormRenderer
          fields={fields}
          values={fieldValues}
          onChange={setField}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <AdminSkillsAndTools
          categoryId={profile.category_id}
          skills={skills}
          tools={tools}
          aiTools={aiTools}
          onSkillsChange={(s) => setField('_skills', s)}
          onToolsChange={(t) => setField('_tools', t)}
          onAiToolsChange={(a) => setField('_ai_tools', a)}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Resume</h2>
        <ResumeUploader value={resumeUrl} onChange={setResumeUrl} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <AdminPortfolioEditor profileId={profileId} skills={skills} />
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 bg-white pt-4">
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          loading={updateUser.isPending || updateProfile.isPending}
          disabled={!dirty}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function ResumeUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const params = new URLSearchParams({ fileName: file.name, folder: 'resumes' });
      const { data } = await api.post<{ fileUrl: string }>(
        `/upload/file?${params.toString()}`,
        file,
        { headers: { 'Content-Type': file.type } },
      );
      onChange(data.fileUrl);
      toast.success('Resume uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            View current resume
          </a>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Replace'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => onChange('')}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload resume (PDF or image)'}
        </button>
      )}
    </div>
  );
}
