import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useTalentCreatableCategories, useCategoryWithFields } from '@/hooks/useCategories';
import { useMyProfiles, useCreateProfile, useUpdateProfile, useSubmitProfile, usePortfolioItems } from '@/hooks/useProfiles';
import { useTalentMe } from '@/hooks/useTalentMe';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import DesignerExtras from '@/components/forms/DesignerExtras';
import PortfolioUploader from '@/components/forms/PortfolioUploader';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import { coerceLeveledList } from '../../../../shared/src/types/talent';
import PendingApprovalBanner from '@/components/talent/PendingApprovalBanner';
import ProfileTrainingGate from '@/components/training/ProfileTrainingGate';
import { useProfileGate } from '@/hooks/useTraining';
import type { Category, CategoryField } from '@/types';

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

export default function ProfileCreate() {
  const router = useRouter();
  const { user } = useAuth();
  const isRejected = user?.approval_status === 'rejected';
  const canSubmit = !isRejected;
  const queryClient = useQueryClient();
  const { data: categories, isLoading: catLoading } = useTalentCreatableCategories();
  const { data: profiles } = useMyProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const submitProfile = useSubmitProfile();

  const { data: talentMe } = useTalentMe();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draftProfileId, setDraftProfileId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveInFlight = useRef(false);
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const hasInitializedLangs = useRef(false);

  const { data: categoryWithFields, isLoading: fieldsLoading } = useCategoryWithFields(
    selectedCategory?.slug
  );
  // Per-category training gate: the talent must finish this category's lesson
  // before the build form is shown. `locked: false` (no lesson / already done)
  // lets the form through immediately.
  const { data: profileGate, isLoading: gateLoading } = useProfileGate(selectedCategory?.id);
  const { data: portfolioItems } = usePortfolioItems(draftProfileId ?? undefined);

  useEffect(() => {
    if (!talentMe || hasInitializedLangs.current) return;
    setLanguages(talentMe.languages_spoken ?? []);
    hasInitializedLangs.current = true;
  }, [talentMe]);

  // Map a talent's live (non-inactive) profiles by category so owned
  // categories can link straight to the existing profile.
  const ownedProfileByCategory = new Map(
    (profiles ?? [])
      .filter((p) => p.status !== 'inactive')
      .map((p) => [p.category_id, p] as const)
  );
  // Show every creatable category (the combined "Designer + Editor" is
  // ghost-only, never picked directly). Categories the talent already has a
  // profile in stay visible and clickable — they route to that profile
  // instead of the create form — so existing talents are never locked out.
  const availableCategories = (categories ?? []).filter(
    (c) => c.slug !== 'designer-editor'
  );

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const skillCount = (values._skills ?? []).length;
  const categoryCount = (values._categories ?? []).length;
  const portfolioReady = skillCount > 0 || categoryCount > 0;
  useEffect(() => {
    if (!portfolioReady) return;
    if (draftProfileId) return;
    if (autoSaveInFlight.current) return;
    if (!selectedCategory) return;
    if (selectedCategory.slug === 'sales') return; // sales has no portfolio — skip early draft

    autoSaveInFlight.current = true;
    setAutoSaving(true);
    api
      .post('/talent/profiles', {
        category_id: selectedCategory.id,
        field_data: values,
      })
      .then((res) => {
        const profile = res.data.profile ?? res.data;
        setDraftProfileId(profile.id);
        queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
        toast.success('Draft saved — you can now upload portfolio items', { duration: 3000 });
      })
      .catch(() => {
        toast.error('Could not auto-save draft. Click "Save as Draft" to enable portfolio uploads.');
      })
      .finally(() => {
        autoSaveInFlight.current = false;
        setAutoSaving(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioReady, draftProfileId, selectedCategory]);

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

    if (selectedCategory?.slug !== 'sales' && (!portfolioItems || portfolioItems.length === 0)) {
      newErrors._portfolio = 'At least one portfolio item is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const persistDraft = async (categoryId: string): Promise<string> => {
    if (draftProfileId) {
      await updateProfile.mutateAsync({ id: draftProfileId, field_data: values });
      return draftProfileId;
    }
    const result = await createProfile.mutateAsync({
      category_id: categoryId,
      field_data: values,
    });
    return result.id;
  };

  const saveLanguages = () =>
    api.put('/talent/me', {
      languages_spoken: languages.filter((e) => e.language),
    });

  const handleSaveDraft = async () => {
    if (!selectedCategory) return;
    try {
      const id = await persistDraft(selectedCategory.id);
      try { await saveLanguages(); } catch { /* best effort */ }
      router.push(`/talent/profiles/${id}`);
    } catch {
      // error handled in hook
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!validate()) return;
    if (!selectedCategory) return;
    try {
      const id = await persistDraft(selectedCategory.id);
      try { await saveLanguages(); } catch { toast.error('Failed to save languages'); }
      await submitProfile.mutateAsync(id);
      router.push(`/talent/profiles/${id}`);
    } catch {
      // error handled in hook
    }
  };

  // ── STEP 1: Category Selection ──
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        {/* Compact Hero */}
        <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
          <div className="hero-content">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">Step 1 of 2 · Pick a category</span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              What kind of work do <span className="text-rainbow">you do</span>?
            </h1>
            <p className="mt-1.5 max-w-xl font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Each profile represents a different way brands can hire you.
            </p>
          </div>
        </section>

        <PendingApprovalBanner />

        {catLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : availableCategories.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E7EA] bg-white px-6 py-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">All caught up</h3>
            <p className="mt-1 text-sm text-[#737373]">
              You already have profiles for all available categories.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCategories.map((cat, i) => {
              const tint = tintFor(cat.name);
              const owned = ownedProfileByCategory.get(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    owned
                      ? router.push(`/talent/profiles/${owned.id}`)
                      : setSelectedCategory(cat)
                  }
                  className={`group relative flex flex-col items-start overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white p-5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:border-[#0a0a0a]/30 active:scale-[0.99] stagger-${Math.min(i + 1, 6)}`}
                >
                  {owned && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[11px] font-medium text-[#15803D]">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Added
                    </span>
                  )}
                  <div
                    className={`${tint} mb-4 flex h-11 w-11 items-center justify-center rounded-xl`}
                    style={{ color: 'var(--tint-icon)' }}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="mt-1 text-sm text-[#737373] line-clamp-2">{cat.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-1 font-[family-name:var(--font-inter)] text-[13px] font-medium text-[#0a0a0a] opacity-0 transition-all duration-200 group-hover:opacity-100">
                    {owned ? 'View profile' : 'Get started'}
                    <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── STEP 2: Form ──
  const tint = tintFor(selectedCategory.name);
  return (
    <div className="space-y-6">
      {/* Compact Hero with back button */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content flex items-start gap-4">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setValues({});
              setErrors({});
              setDraftProfileId(null);
              setAutoSaving(false);
              setLanguages(talentMe?.languages_spoken ?? []);
              hasInitializedLangs.current = false;
            }}
            className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#f0f0f0] text-[#525252] transition-colors hover:bg-[#dedede] hover:text-[#0a0a0a]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div
              className={`${tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
              style={{ color: 'var(--tint-icon)' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <p className="font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                Step 2 of 2 · New Profile
              </p>
              <h1 className="font-[family-name:var(--font-jakarta)] text-[22px] sm:text-[26px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">
                {selectedCategory.name}
              </h1>
            </div>
          </div>
        </div>
      </section>

      <PendingApprovalBanner />

      {gateLoading || fieldsLoading ? (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-[#f0f0f0]" />
            ))}
          </div>
        </div>
      ) : profileGate?.locked && profileGate.chapter ? (
        <ProfileTrainingGate
          categoryName={selectedCategory.name}
          chapter={profileGate.chapter}
        />
      ) : (
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
          {selectedCategory && (
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
                categoryId={selectedCategory.id}
                categorySlug={selectedCategory.slug}
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
                showAccountingSoftware={selectedCategory.slug === 'accountant'}
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
          {selectedCategory.slug !== 'sales' && (
          <section className="rounded-2xl border border-[#E7E7EA] bg-white p-6 sm:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="mb-5 flex items-start gap-3">
              <div className="tint-pink flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ color: 'var(--tint-icon)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                  Portfolio
                </h2>
                <p className="mt-0.5 text-sm text-[#737373]">
                  {draftProfileId && portfolioReady
                    ? 'Upload samples that show your best work'
                    : 'Pick at least one skill or category above to enable uploads'}
                </p>
              </div>
            </div>
            {draftProfileId && portfolioReady ? (
              <PortfolioUploader
                profileId={draftProfileId}
                skills={values._skills ?? []}
                categories={(values._categories ?? []).map((c: { category: string }) => c.category)}
                categoryId={selectedCategory.id}
              />
            ) : (
              <div className="rounded-xl border-2 border-dashed border-[#E7E7EA] bg-[#F5F5F6] p-8 text-center">
                <p className="text-sm text-[#737373]">
                  {autoSaving ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0a0a0a]" />
                      Preparing portfolio uploader…
                    </span>
                  ) : (
                    'Pick at least one skill or category above to upload portfolio items.'
                  )}
                </p>
              </div>
            )}
            {errors._portfolio && (
              <p className="mt-3 text-sm text-red-600">{errors._portfolio}</p>
            )}
          </section>
          )}
        </div>
      )}

      {/* Sticky action bar — hidden while the category's training gate is unmet */}
      {!(profileGate?.locked && profileGate.chapter) && (
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E7EA] bg-white/95 backdrop-blur-md p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]">
        <div className="text-xs text-[#737373] px-2">
          {isRejected
            ? 'Submitting is locked because this account was not approved.'
            : 'Save as draft, or submit for review when ready.'}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            loading={createProfile.isPending || updateProfile.isPending}
            disabled={autoSaving}
          >
            Save as Draft
          </Button>
          <button
            type="button"
            onClick={handleSaveAndSubmit}
            disabled={!canSubmit || autoSaving || createProfile.isPending || updateProfile.isPending || submitProfile.isPending}
            className="btn-iridescent disabled:opacity-50"
          >
            {(createProfile.isPending || updateProfile.isPending || submitProfile.isPending) ? 'Saving…' : 'Save & Submit'}
          </button>
        </div>
      </div>
      )}


    </div>
  );
}
