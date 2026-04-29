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
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';
import PendingApprovalBanner from '@/components/talent/PendingApprovalBanner';
import ApprovalCelebration from '@/components/talent/ApprovalCelebration';
import type { Category } from '@/types';

export default function ProfileCreate() {
  const router = useRouter();
  const { user, refetchUser } = useAuth();
  const isApproved = user?.approval_status === 'approved';
  const autoApproveActive = user?.auto_approve_signups === true;
  const canSubmit = isApproved || autoApproveActive;
  const queryClient = useQueryClient();
  // Designer + Editor is filtered out server-side here — that combined
  // category is auto-generated as a ghost when the talent has both a
  // Designer profile and a Video Editor profile.
  const { data: categories, isLoading: catLoading } = useTalentCreatableCategories();
  const { data: profiles } = useMyProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const submitProfile = useSubmitProfile();

  const { data: talentMe } = useTalentMe();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [celebrationPhase, setCelebrationPhase] = useState<'loading' | 'approved' | null>(null);
  const [draftProfileId, setDraftProfileId] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveInFlight = useRef(false);
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);
  const hasInitializedLangs = useRef(false);

  const { data: categoryWithFields, isLoading: fieldsLoading } = useCategoryWithFields(
    selectedCategory?.slug
  );
  const { data: portfolioItems } = usePortfolioItems(draftProfileId ?? undefined);

  useEffect(() => {
    if (!talentMe || hasInitializedLangs.current) return;
    setLanguages(talentMe.languages_spoken ?? []);
    hasInitializedLangs.current = true;
  }, [talentMe]);

  // Exclude categories the user already has profiles for
  const existingCategoryIds = new Set(
    (profiles ?? [])
      .filter((p) => p.status !== 'inactive')
      .map((p) => p.category_id)
  );
  const availableCategories = (categories ?? []).filter(
    (c) => !existingCategoryIds.has(c.id) && c.slug !== 'designer-editor'
  );

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Auto-create a draft profile the first time the user picks a skill so the
  // PortfolioUploader (which needs a profile_id for portfolio_items rows) can
  // render inline. Once draftProfileId is set, subsequent saves are updates.
  const skillCount = (values._skills ?? []).length;
  useEffect(() => {
    if (skillCount === 0) return;
    if (draftProfileId) return;
    if (autoSaveInFlight.current) return;
    if (!selectedCategory) return;

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
  }, [skillCount, draftProfileId, selectedCategory]);

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

    const filledLanguages = languages.filter((e) => e.language);
    if (!filledLanguages.some((e) => e.proficiency === 'native')) {
      newErrors._languages = 'At least one language must be set as native';
    }

    if (!portfolioItems || portfolioItems.length === 0) {
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
    const willAutoApprove = !isApproved && autoApproveActive;
    try {
      if (willAutoApprove) setCelebrationPhase('loading');
      const id = await persistDraft(selectedCategory.id);
      try { await saveLanguages(); } catch { toast.error('Failed to save languages'); }
      const submitted: any = await submitProfile.mutateAsync(id);
      if (willAutoApprove && submitted?.auto_approved) {
        await refetchUser();
        setCelebrationPhase('approved');
        await new Promise((r) => setTimeout(r, 1400));
      }
      router.push(`/talent/profiles/${id}`);
    } catch {
      setCelebrationPhase(null);
      // error handled in hook
    }
  };

  // Step 1: Category selection
  if (!selectedCategory) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Step 1: Select a category for your profile
          </p>
        </div>

        {!isApproved && <PendingApprovalBanner />}

        {catLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : availableCategories.length === 0 ? (
          <Card className="py-12 text-center">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">No categories available</h3>
            <p className="text-sm text-gray-500">
              You already have profiles for all available categories, or no categories exist yet.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCategories.map((cat) => (
              <Card
                key={cat.id}
                className="cursor-pointer transition-all hover:border-indigo-300 hover:shadow-md"
                onClick={() => setSelectedCategory(cat)}
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{cat.name}</h3>
                {cat.description && (
                  <p className="mt-1 text-sm text-gray-500">{cat.description}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2: Fill in the form
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create {selectedCategory.name} Profile
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Step 2: Fill in your profile details
          </p>
        </div>
      </div>

      {!isApproved && <PendingApprovalBanner />}

      <Card>
        {fieldsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : (
          <>
            <DynamicFormRenderer
              fields={categoryWithFields?.fields ?? []}
              values={values}
              onChange={handleChange}
              errors={errors}
            />

            {/* Skills with proficiency & Tools */}
            {selectedCategory && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <DesignerExtras
                  categoryId={selectedCategory.id}
                  categorySlug={selectedCategory.slug}
                  skills={values._skills ?? []}
                  tools={values._tools ?? []}
                  aiTools={values._ai_tools ?? []}
                  categories={values._categories ?? []}
                  accountingSoftware={values._accounting_software ?? []}
                  onSkillsChange={(s) => handleChange('_skills', s)}
                  onToolsChange={(t) => handleChange('_tools', t)}
                  onAiToolsChange={(at) => handleChange('_ai_tools', at)}
                  onCategoriesChange={(c) => handleChange('_categories', c)}
                  onAccountingSoftwareChange={(v) => handleChange('_accounting_software', v)}
                  showAccountingSoftware={selectedCategory.slug === 'accountant'}
                />
              </div>
            )}

            {/* Languages */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <LanguagePicker value={languages} onChange={setLanguages} />
              {errors._languages && (
                <p className="mt-1 text-sm text-red-600">{errors._languages}</p>
              )}
            </div>

            {/* Portfolio — appears once a draft exists (auto-created on first skill) */}
            {draftProfileId && skillCount > 0 && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <PortfolioUploader
                  profileId={draftProfileId}
                  skills={values._skills ?? []}
                  categories={(values._categories ?? []).map((c: { category: string }) => c.category)}
                  categoryId={selectedCategory.id}
                />
                {errors._portfolio && (
                  <p className="mt-2 text-sm text-red-600">{errors._portfolio}</p>
                )}
              </div>
            )}
            {autoSaving && (
              <p className="mt-4 text-xs text-gray-500">Preparing portfolio uploader…</p>
            )}
            {!draftProfileId && errors._portfolio && (
              <p className="mt-4 text-sm text-red-600">{errors._portfolio}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                loading={createProfile.isPending || updateProfile.isPending}
                disabled={autoSaving}
              >
                Save as Draft
              </Button>
              <Button
                onClick={handleSaveAndSubmit}
                loading={createProfile.isPending || updateProfile.isPending || submitProfile.isPending}
                disabled={!canSubmit || autoSaving}
                title={
                  !canSubmit
                    ? 'Available after account approval'
                    : !isApproved && autoApproveActive
                    ? 'Submitting will activate your account instantly'
                    : undefined
                }
              >
                Save & Submit for Review
              </Button>
              {!isApproved && !autoApproveActive && (
                <span className="text-xs text-gray-500">
                  Submission unlocks once your account is approved.
                </span>
              )}
              {!isApproved && autoApproveActive && (
                <span className="text-xs text-indigo-600">
                  Submitting will activate your account instantly.
                </span>
              )}
            </div>
          </>
        )}
      </Card>
      {celebrationPhase && <ApprovalCelebration phase={celebrationPhase} />}
    </div>
  );
}
