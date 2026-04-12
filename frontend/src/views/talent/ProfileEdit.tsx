import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile, useUpdateProfile, useSubmitProfile } from '@/hooks/useProfiles';
import { useCategoryWithFields } from '@/hooks/useCategories';
import { useTalentMe } from '@/hooks/useTalentMe';
import api from '@/services/api';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import DesignerExtras from '@/components/forms/DesignerExtras';
import PortfolioUploader from '@/components/forms/PortfolioUploader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';

export default function ProfileEdit({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile(profileId);
  const updateProfile = useUpdateProfile();
  const submitProfile = useSubmitProfile();

  const { data: talentMe } = useTalentMe();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [languages, setLanguages] = useState('');

  const { data: categoryWithFields, isLoading: fieldsLoading } = useCategoryWithFields(
    profile?.category?.slug
  );

  useEffect(() => {
    if (profile?.field_data) {
      setValues(profile.field_data);
    }
  }, [profile]);

  useEffect(() => {
    if (talentMe?.languages_spoken) {
      setLanguages(talentMe.languages_spoken.join(', '));
    }
  }, [talentMe]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of categoryWithFields?.fields ?? []) {
      if (!field.is_active) continue;
      const val = values[field.field_key];

      if (field.is_required) {
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.field_key] = `${field.field_label} is required`;
          continue;
        }
      }

      // Portfolio link validation: reject Dribbble and Behance
      if (field.field_key === 'portfolio_link' && val && typeof val === 'string') {
        try {
          const url = new URL(val);
          const host = url.hostname.toLowerCase();
          if (host.includes('dribbble.com') || host.includes('behance.net')) {
            newErrors[field.field_key] = 'Dribbble and Behance links are not accepted. Please use a cloud drive link (Google Drive, OneDrive, etc.).';
          }
        } catch {
          newErrors[field.field_key] = 'Please enter a valid URL';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveLanguages = () =>
    api.put('/talent/me', {
      languages_spoken: languages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });

  const handleSave = async () => {
    if (!profileId) return;
    if (profile?.status === 'approved') {
      const confirmed = confirm(
        'Saving will change your profile status from approved to pending review. Your profile will go offline until re-approved. Continue?'
      );
      if (!confirmed) return;
    }
    try {
      await Promise.all([
        updateProfile.mutateAsync({ id: profileId, field_data: values }),
        saveLanguages(),
      ]);
      router.push(`/talent/profiles/${profileId}`);
    } catch {
      // handled in hook
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!validate() || !profileId) return;
    try {
      await Promise.all([
        updateProfile.mutateAsync({ id: profileId, field_data: values }),
        saveLanguages(),
      ]);
      await submitProfile.mutateAsync(profileId);
      router.push(`/talent/profiles/${profileId}`);
    } catch {
      // handled in hook
    }
  };

  if (profileLoading || fieldsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="py-12 text-center">
        <h3 className="text-lg font-semibold text-gray-900">Profile not found</h3>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit {profile.category?.name} Profile
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusToBadgeVariant(profile.status)}>
              {profile.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
      </div>

      {profile.rejection_reason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="mb-1 text-sm font-semibold text-red-800">Rejection Reason</h3>
          <p className="text-sm text-red-700">{profile.rejection_reason}</p>
        </div>
      )}

      {profile.status === 'approved' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-1 text-sm font-semibold text-amber-800">Warning</h3>
          <p className="text-sm text-amber-700">
            This profile is currently approved and visible to businesses. Saving changes will reset
            its status to pending review, and it will go offline until re-approved.
          </p>
        </div>
      )}

      <Card>
        <DynamicFormRenderer
          fields={categoryWithFields?.fields ?? []}
          values={values}
          onChange={handleChange}
          errors={errors}
        />

        {/* Languages */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <Input
            label="Languages Spoken (comma-separated)"
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="English, Hindi, Tamil"
          />
        </div>

        {/* Skills with proficiency & Tools */}
        {profile && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <DesignerExtras
              categoryId={profile.category_id}
              skills={values._skills ?? []}
              tools={values._tools ?? []}
              aiTools={values._ai_tools ?? []}
              onSkillsChange={(s) => handleChange('_skills', s)}
              onToolsChange={(t) => handleChange('_tools', t)}
              onAiToolsChange={(at) => handleChange('_ai_tools', at)}
            />
          </div>
        )}

        {/* Portfolio */}
        {profile && (values._skills ?? []).length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <PortfolioUploader
              profileId={profileId}
              skills={values._skills ?? []}
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
          <Button
            variant="outline"
            onClick={handleSave}
            loading={updateProfile.isPending}
          >
            Save Changes
          </Button>
          {(profile.status === 'draft' || profile.status === 'rejected') && (
            <Button
              onClick={handleSaveAndSubmit}
              loading={updateProfile.isPending || submitProfile.isPending}
            >
              Save & Submit for Review
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
