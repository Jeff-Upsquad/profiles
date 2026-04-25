'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useCategories } from '@/hooks/useCategories';
import {
  useCreateTalentAccessGrant,
  useUpdateTalentAccessGrant,
  type AccessGrant,
} from '@/hooks/useTalentAccess';

interface Props {
  /** When provided, the form is in edit mode and will PATCH this grant. */
  grant?: AccessGrant;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const DEFAULT_DAYS = 5;

function defaultExpiryDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_DAYS);
  return d.toISOString().split('T')[0]!;
}

function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toISOString().split('T')[0]!;
}

export default function TalentAccessForm({ grant, onSuccess, onCancel }: Props) {
  const isEdit = !!grant;
  const { data: categories, isLoading: loadingCats } = useCategories();
  const createMutation = useCreateTalentAccessGrant();
  const updateMutation = useUpdateTalentAccessGrant();

  const [email, setEmail] = useState(grant?.email ?? '');
  const [expiresOn, setExpiresOn] = useState(
    isEdit ? dateInputValue(grant?.expires_at) : defaultExpiryDate(),
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    grant?.categories.map((c) => c.id) ?? [],
  );
  const [notes, setNotes] = useState(grant?.notes ?? '');

  // Keep state in sync if the form is reused for a different grant
  useEffect(() => {
    if (!grant) return;
    setEmail(grant.email);
    setExpiresOn(dateInputValue(grant.expires_at));
    setSelectedCategoryIds(grant.categories.map((c) => c.id));
    setNotes(grant.notes ?? '');
  }, [grant]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (selectedCategoryIds.length === 0) return;

    // Send end-of-day so a 5-day grant expires at the end of day 5, not start of day 5.
    const expires_at = expiresOn
      ? new Date(`${expiresOn}T23:59:59`).toISOString()
      : undefined;

    if (isEdit && grant) {
      await updateMutation.mutateAsync({
        id: grant.id,
        expires_at,
        category_ids: selectedCategoryIds,
        notes: notes.trim() || null,
      });
    } else {
      await createMutation.mutateAsync({
        email: email.trim(),
        expires_at,
        category_ids: selectedCategoryIds,
        notes: notes.trim() || undefined,
      });
    }
    onSuccess?.();
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const activeCategories = (categories ?? []).filter((c) => c.is_active);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="reviewer@example.com"
        disabled={isEdit}
        helperText={isEdit ? 'Email cannot be changed after the grant is created.' : undefined}
        required
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Expiration Date
        </label>
        <input
          type="date"
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          required
        />
        <p className="mt-1 text-xs text-gray-500">
          Default is 5 days from today.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Categories <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">
          The grantee will see profiles from every selected category and can switch
          between them on the browse page.
        </p>
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          {loadingCats ? (
            <p className="text-sm text-gray-500">Loading categories…</p>
          ) : activeCategories.length === 0 ? (
            <p className="text-sm text-gray-500">No active categories.</p>
          ) : (
            activeCategories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{cat.name}</span>
              </label>
            ))
          )}
        </div>
        {selectedCategoryIds.length === 0 && (
          <p className="mt-1 text-xs text-red-500">Select at least one category.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Internal notes about who this grant is for…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={selectedCategoryIds.length === 0}
        >
          {isEdit ? 'Save Changes' : 'Create Grant'}
        </Button>
      </div>
    </form>
  );
}
