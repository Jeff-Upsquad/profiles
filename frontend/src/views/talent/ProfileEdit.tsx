import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile, useUpdateProfile, useSubmitProfile } from '@/hooks/useProfiles';
import { useCategoryWithFields } from '@/hooks/useCategories';
import { useTalentMe } from '@/hooks/useTalentMe';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import toast from 'react-hot-toast';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import DesignerExtras from '@/components/forms/DesignerExtras';
import PortfolioUploader from '@/components/forms/PortfolioUploader';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import PendingApprovalBanner from '@/components/talent/PendingApprovalBanner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';

export default function ProfileEdit({ profileId }: { profileId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isApproved = user?.approval_status === 'approved';
  const { data: profile, isLoading: profileLoading } = useProfile(profileId);
  const updateProfile = useUpdateProfile();
  const submitProfile = useSubmitProfile();

  const { data: talentMe } = useTalentMe();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const initialValues = useRef<string>('');
  const initialLanguages = useRef<string>('');
  const hasInitializedValues = useRef(false);
  const hasInitializedLangs = useRef(false);
  const [dirty, setDirty] = useState(false);

  const { data: categoryWithFields, isLoading: fieldsLoading } = useCategoryWithFields(
    profile?.category?.slug
  );

  useEffect(() => {
    if (!profile || hasInitializedValues.current) return;
    setValues(profile.field_data ?? {});
    initialValues.current = JSON.stringify(profile.field_data ?? {});
    hasInitializedValues.current = true;
  }, [profile]);

  useEffect(() => {
    if (!talentMe || hasInitializedLangs.current) return;
    setLanguages(talentMe.languages_spoken ?? []);
    initialLanguages.current = JSON.stringify(talentMe.languages_spoken ?? []);
    hasInitializedLangs.current = true;
  }, [talentMe]);

  // Track dirty state
  useEffect(() => {
    const valuesDirty = hasInitializedValues.current && JSON.stringify(values) !== initialValues.current;
    const langDirty = hasInitializedLangs.current && JSON.stringify(languages) !== initialLanguages.current;
    setDirty(!!(valuesDirty || langDirty));
  }, [values, languages]);

  // Warn on browser close / refresh
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Guard browser back / swipe navigation
  useEffect(() => {
    if (!dirty) return;
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      if (window.confirm('You have unsaved changes. Discard and leave this page?')) {
        window.history.back();
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [dirty]);

  const confirmDiscard = useCallback(() => {
    if (!dirty) return true;
    return window.confirm('You have unsaved changes. Discard and leave this page?');
  }, [dirty]);

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
      languages_spoken: languages.filter((e) => e.language),
    });

  const handleSave = async () => {
    if (!profileId) return;
    try {
      await updateProfile.mutateAsync({ id: profileId, field_data: values });
    } catch {
      return; // toast shown by mutation hook
    }
    try {
      await saveLanguages();
    } catch {
      toast.error('Failed to save languages');
    }
    await queryClient.invalidateQueries({ queryKey: ['talentMe'] });
    setDirty(false);
    router.push(`/talent/profiles/${profileId}`);
  };

  const handleSaveAndSubmit = async () => {
    if (!validate() || !profileId) return;
    try {
      await updateProfile.mutateAsync({ id: profileId, field_data: values });
    } catch {
      return; // toast shown by mutation hook
    }
    try {
      await saveLanguages();
    } catch {
      toast.error('Failed to save languages');
    }
    await queryClient.invalidateQueries({ queryKey: ['talentMe'] });
    setDirty(false);
    try {
      await submitProfile.mutateAsync(profileId);
    } catch {
      return; // toast shown by mutation hook
    }
    router.push(`/talent/profiles/${profileId}`);
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
          onClick={() => { if (confirmDiscard()) router.back(); }}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Edit {profile.category?.name} Profile
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={statusToBadgeVariant(profile.status)}>
              {profile.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
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
              disabled={!isApproved}
              title={!isApproved ? 'Available after account approval' : undefined}
            >
              Save & Submit
            </Button>
          )}
        </div>
      </div>

      {!isApproved && <PendingApprovalBanner />}

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
          <LanguagePicker value={languages} onChange={setLanguages} />
        </div>

        {/* Skills with proficiency & Tools */}
        {profile && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <DesignerExtras
              categoryId={profile.category_id}
              skills={values._skills ?? []}
              tools={values._tools ?? []}
              aiTools={values._ai_tools ?? []}
              accountingSoftware={values._accounting_software ?? []}
              onSkillsChange={(s) => handleChange('_skills', s)}
              onToolsChange={(t) => handleChange('_tools', t)}
              onAiToolsChange={(at) => handleChange('_ai_tools', at)}
              onAccountingSoftwareChange={(v) => handleChange('_accounting_software', v)}
              showAccountingSoftware={profile.category?.slug === 'accountant'}
            />
          </div>
        )}

        {/* Portfolio */}
        {profile && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            {(values._skills ?? []).length > 0 ? (
              <PortfolioUploader
                profileId={profileId}
                skills={values._skills ?? []}
              />
            ) : (
              <div>
                <h3 className="text-base font-semibold text-gray-900">Portfolio</h3>
                <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                  <p className="text-sm text-gray-600">
                    Select at least one skill in <strong>Skill Sets</strong> above to start
                    uploading portfolio items for it.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </Card>
    </div>
  );
}
