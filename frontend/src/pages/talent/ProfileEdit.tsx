import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfile, useUpdateProfile, useSubmitProfile } from '@/hooks/useProfiles';
import { useCategoryWithFields } from '@/hooks/useCategories';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';

export default function ProfileEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useProfile(id);
  const updateProfile = useUpdateProfile();
  const submitProfile = useSubmitProfile();

  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categoryWithFields, isLoading: fieldsLoading } = useCategoryWithFields(
    profile?.category?.slug
  );

  useEffect(() => {
    if (profile?.field_data) {
      setValues(profile.field_data);
    }
  }, [profile]);

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = (): boolean => {
    if (!categoryWithFields?.fields) return false;
    const newErrors: Record<string, string> = {};

    for (const field of categoryWithFields.fields) {
      if (!field.is_active) continue;
      if (field.is_required) {
        const val = values[field.field_key];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.field_key] = `${field.field_label} is required`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateProfile.mutateAsync({ id, field_data: values });
      navigate(`/talent/profiles/${id}`);
    } catch {
      // handled in hook
    }
  };

  const handleSaveAndSubmit = async () => {
    if (!validate() || !id) return;
    try {
      await updateProfile.mutateAsync({ id, field_data: values });
      await submitProfile.mutateAsync(id);
      navigate(`/talent/profiles/${id}`);
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
          onClick={() => navigate(-1)}
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

      <Card>
        <DynamicFormRenderer
          fields={categoryWithFields?.fields ?? []}
          values={values}
          onChange={handleChange}
          errors={errors}
        />

        <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-200 pt-6">
          <Button
            variant="outline"
            onClick={handleSave}
            loading={updateProfile.isPending}
          >
            Save Changes
          </Button>
          <Button
            onClick={handleSaveAndSubmit}
            loading={updateProfile.isPending || submitProfile.isPending}
          >
            Save & Submit for Review
          </Button>
        </div>
      </Card>
    </div>
  );
}
