import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCategories, useCategoryWithFields } from '@/hooks/useCategories';
import { useMyProfiles, useCreateProfile, useSubmitProfile } from '@/hooks/useProfiles';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import DesignerExtras from '@/components/forms/DesignerExtras';
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
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: profiles } = useMyProfiles();
  const createProfile = useCreateProfile();
  const submitProfile = useSubmitProfile();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [celebrationPhase, setCelebrationPhase] = useState<'loading' | 'approved' | null>(null);

  const { data: categoryWithFields, isLoading: fieldsLoading } = useCategoryWithFields(
    selectedCategory?.slug
  );

  // Exclude categories the user already has profiles for
  const existingCategoryIds = new Set(
    (profiles ?? [])
      .filter((p) => p.status !== 'inactive')
      .map((p) => p.category_id)
  );
  const availableCategories = (categories ?? []).filter(
    (c) => !existingCategoryIds.has(c.id)
  );

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

  const handleSaveDraft = async () => {
    if (!selectedCategory) return;
    try {
      const result = await createProfile.mutateAsync({
        category_id: selectedCategory.id,
        field_data: values,
      });
      router.push(`/talent/profiles/${result.id}`);
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
      const result = await createProfile.mutateAsync({
        category_id: selectedCategory.id,
        field_data: values,
      });
      const submitted: any = await submitProfile.mutateAsync(result.id);
      if (willAutoApprove && submitted?.auto_approved) {
        await refetchUser();
        setCelebrationPhase('approved');
        await new Promise((r) => setTimeout(r, 1400));
      }
      router.push(`/talent/profiles/${result.id}`);
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
                  skills={values._skills ?? []}
                  tools={values._tools ?? []}
                  aiTools={values._ai_tools ?? []}
                  accountingSoftware={values._accounting_software ?? []}
                  onSkillsChange={(s) => handleChange('_skills', s)}
                  onToolsChange={(t) => handleChange('_tools', t)}
                  onAiToolsChange={(at) => handleChange('_ai_tools', at)}
                  onAccountingSoftwareChange={(v) => handleChange('_accounting_software', v)}
                  showAccountingSoftware={selectedCategory.slug === 'accountant'}
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-200 pt-6">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                loading={createProfile.isPending}
              >
                Save as Draft
              </Button>
              <Button
                onClick={handleSaveAndSubmit}
                loading={createProfile.isPending || submitProfile.isPending}
                disabled={!canSubmit}
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
