import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile, useUpdateProfile, useSubmitProfile, usePortfolioItems } from '@/hooks/useProfiles';
import { useCategoryWithFields } from '@/hooks/useCategories';
import { useTalentMe } from '@/hooks/useTalentMe';
import { useAuth } from '@/context/AuthContext';
import { coerceLeveledList } from '../../../../shared/src/types/talent';
import api from '@/services/api';
import toast from 'react-hot-toast';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import DesignerExtras from '@/components/forms/DesignerExtras';
import PortfolioUploader from '@/components/forms/PortfolioUploader';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import PendingApprovalBanner from '@/components/talent/PendingApprovalBanner';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';
import type { CategoryField } from '@/types';

const BUILTIN_EXPERIENCE_FIELD: CategoryField = {
  id: '_experience',
  category_id: '',
  field_key: '_experience',
  field_label: 'Experience',
  field_type: 'experience',
  is_required: true,
  is_active: true,
  sort_order: -1,
  helper_text: 'How many years and months of relevant work experience do you have?',
};

function isExperienceEmpty(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
  const { years, months } = value as { years?: unknown; months?: unknown };
  return (typeof years !== 'number' || years < 0 || years > 50) && (typeof months !== 'number' || months < 0 || months > 11);
}

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function ProfileEdit({ profileId }: { profileId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isApproved = user?.approval_status === 'approved';
  const { data: profile, isLoading: profileLoading } = useProfile(profileId);
  const updateProfile = useUpdateProfile();
  const submitProfile = useSubmitProfile();
  const { data: portfolioItems } = usePortfolioItems(profileId);

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
    const fd = { ...(profile.field_data ?? {}) };
    if (Array.isArray(fd._categories) && fd._categories.length > 0 && typeof fd._categories[0] === 'string') {
      fd._categories = fd._categories.map((category: string) => ({ category, level: 5 }));
    }
    setValues(fd);
    initialValues.current = JSON.stringify(fd);
    hasInitializedValues.current = true;
  }, [profile]);

  useEffect(() => {
    if (!talentMe || hasInitializedLangs.current) return;
    setLanguages(talentMe.languages_spoken ?? []);
    initialLanguages.current = JSON.stringify(talentMe.languages_spoken ?? []);
    hasInitializedLangs.current = true;
  }, [talentMe]);

  useEffect(() => {
    const valuesDirty = hasInitializedValues.current && JSON.stringify(values) !== initialValues.current;
    const langDirty = hasInitializedLangs.current && JSON.stringify(languages) !== initialLanguages.current;
    setDirty(!!(valuesDirty || langDirty));
  }, [values, languages]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

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

    if (isExperienceEmpty(values._experience)) {
      newErrors._experience = 'Experience is required';
    }

    for (const field of categoryWithFields?.fields ?? []) {
      if (!field.is_active) continue;
      const val = values[field.field_key];

      if (field.is_required) {
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.field_key] = `${field.field_label} is required`;
          continue;
        }
      }

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

    const filledLanguages = languages.filter((e) => e.language);
    if (!filledLanguages.some((e) => e.proficiency === 'native')) {
      newErrors._languages = 'At least one language must be set as native';
    }

    if (profile?.category?.slug !== 'sales' && (!portfolioItems || portfolioItems.length === 0)) {
      newErrors._portfolio = 'At least one portfolio item is required';
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
      return;
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
      return;
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
      return;
    }
    router.push(`/talent/profiles/${profileId}`);
  };

  if (profileLoading || fieldsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white py-16 px-6 text-center">
        <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">Profile not found</h3>
      </div>
    );
  }

  const tint = tintFor(profile.category?.name ?? '');

  return (
    <div className="space-y-6">
      {/* Compact Hero with back button */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (confirmDiscard()) router.back(); }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#f0f0f0] text-[#525252] transition-colors hover:bg-[#dedede] hover:text-[#0a0a0a]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div
              className={`${tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
              style={{ color: 'var(--tint-icon)' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                  Editing
                </p>
                <Badge variant={statusToBadgeVariant(profile.status)}>
                  {profile.status.replace('_', ' ')}
                </Badge>
              </div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-[22px] sm:text-[26px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] truncate">
                {profile.category?.name}
              </h1>
            </div>
          </div>
          {dirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
        </div>
      </section>

      {!isApproved && <PendingApprovalBanner />}

      {profile.rejection_reason && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-red-900">Rejected</h3>
            <p className="mt-0.5 text-sm text-red-700">{profile.rejection_reason}</p>
          </div>
        </div>
      )}

      {profile.status === 'approved' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-amber-900">This profile is live</h3>
            <p className="mt-0.5 text-sm text-amber-800">
              Saving will reset its status to pending review and take it offline until re-approved.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Profile Details */}
        <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-start gap-3">
            <div className="tint-purple flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Profile Details
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">Tell brands about your work and experience</p>
            </div>
          </div>
          <DynamicFormRenderer
            fields={[BUILTIN_EXPERIENCE_FIELD, ...(categoryWithFields?.fields ?? [])]}
            values={values}
            onChange={handleChange}
            errors={errors}
          />
        </section>

        {/* Skills & Tools */}
        {profile && (
          <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-5 flex items-start gap-3">
              <div className="tint-orange flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                  Skills & Tools
                </h2>
                <p className="mt-0.5 text-sm text-[#737373]">Pick what you specialise in</p>
              </div>
            </div>
            <DesignerExtras
              categoryId={profile.category_id}
              categorySlug={profile.category?.slug}
              skills={values._skills ?? []}
              tools={coerceLeveledList(values._tools)}
              aiTools={coerceLeveledList(values._ai_tools)}
              categories={values._categories ?? []}
              accountingSoftware={values._accounting_software ?? []}
              industryExperience={values._industry_experience ?? []}
              onSkillsChange={(s) => handleChange('_skills', s)}
              onToolsChange={(t) => handleChange('_tools', t)}
              onAiToolsChange={(at) => handleChange('_ai_tools', at)}
              onCategoriesChange={(c) => handleChange('_categories', c)}
              onAccountingSoftwareChange={(v) => handleChange('_accounting_software', v)}
              onIndustryExperienceChange={(v) => handleChange('_industry_experience', v)}
              showAccountingSoftware={profile.category?.slug === 'accountant'}
            />
          </section>
        )}

        {/* Languages */}
        <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-5 flex items-start gap-3">
            <div className="tint-blue flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Languages
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">Add languages you can work in</p>
            </div>
          </div>
          <LanguagePicker value={languages} onChange={setLanguages} />
          {errors._languages && (
            <p className="mt-2 text-sm text-red-600">{errors._languages}</p>
          )}
        </section>

        {/* Portfolio — not required for sales profiles */}
        {profile && profile.category?.slug !== 'sales' && (
          <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-5 flex items-start gap-3">
              <div className="tint-pink flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                  Portfolio
                </h2>
                <p className="mt-0.5 text-sm text-[#737373]">
                  {(values._skills ?? []).length > 0 || (values._categories ?? []).length > 0
                    ? 'Upload samples that show your best work'
                    : 'Pick at least one skill or category above to enable uploads'}
                </p>
              </div>
            </div>
            {(values._skills ?? []).length > 0 || (values._categories ?? []).length > 0 ? (
              <PortfolioUploader
                profileId={profileId}
                skills={values._skills ?? []}
                categories={(values._categories ?? []).map((c: { category: string }) => c.category)}
                categoryId={profile.category_id}
              />
            ) : (
              <div className="rounded-xl border-2 border-dashed border-[#E7E7EA] bg-[#F5F5F6] p-8 text-center">
                <p className="text-sm text-[#737373]">
                  Pick at least one skill or category above to upload portfolio items.
                </p>
              </div>
            )}
            {errors._portfolio && (
              <p className="mt-3 text-sm text-red-600">{errors._portfolio}</p>
            )}
          </section>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E7EA] bg-white/95 backdrop-blur-md p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]">
        <div className="text-xs text-[#737373] px-2">
          {dirty ? 'You have unsaved changes' : 'No changes yet'}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} loading={updateProfile.isPending}>
            Save Changes
          </Button>
          {(profile.status === 'draft' || profile.status === 'rejected') && (
            <button
              type="button"
              onClick={handleSaveAndSubmit}
              disabled={!isApproved || updateProfile.isPending || submitProfile.isPending}
              title={!isApproved ? 'Available after account approval' : undefined}
              className="btn-iridescent disabled:opacity-50"
            >
              {(updateProfile.isPending || submitProfile.isPending) ? 'Submitting…' : 'Save & Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
