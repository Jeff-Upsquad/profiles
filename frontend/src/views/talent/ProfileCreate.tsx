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
import type { Category } from '@/types';

export default function ProfileCreate() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: profiles } = useMyProfiles();
  const createProfile = useCreateProfile();
  const submitProfile = useSubmitProfile();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const isDesignerCategory = selectedCategory?.slug === 'designer' || selectedCategory?.name?.toLowerCase() === 'designer';

  const validate = (): boolean => {
    if (!categoryWithFields?.fields) return false;
    const newErrors: Record<string, string> = {};

    for (const field of categoryWithFields.fields) {
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
    try {
      const result = await createProfile.mutateAsync({
        category_id: selectedCategory.id,
        field_data: values,
      });
      await submitProfile.mutateAsync(result.id);
      router.push(`/talent/profiles/${result.id}`);
    } catch {
      // error handled in hook
    }
  };

  // Block if not approved
  if (user?.approval_status !== 'approved') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Profile</h1>
        <Card className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">This module is locked</h3>
          <p className="text-sm text-gray-500">
            This will be opened once your account is approved.
          </p>
        </Card>
      </div>
    );
  }

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

            {/* Designer-specific: Skills with proficiency & Tools */}
            {isDesignerCategory && selectedCategory && (
              <div className="mt-6 border-t border-gray-200 pt-6">
                <DesignerExtras
                  categoryId={selectedCategory.id}
                  skills={values._skills ?? []}
                  tools={values._tools ?? []}
                  onSkillsChange={(s) => handleChange('_skills', s)}
                  onToolsChange={(t) => handleChange('_tools', t)}
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
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
              >
                Save & Submit for Review
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
