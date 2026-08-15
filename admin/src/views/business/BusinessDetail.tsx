'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface Subscription {
  id: string;
  category_id: string;
  category?: Category;
}

interface SharedProfile {
  id: string;
  talent_profile_id: string;
  category_id: string;
  profile?: {
    id: string;
    field_data: Record<string, any>;
    talent_user?: {
      full_name: string;
      current_location?: string;
    };
    category?: Category;
    tier?: 'junior' | 'pro' | 'Top Talents' | 'custom' | null;
    tier_custom?: string | null;
  };
}

interface TalentProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  field_data: Record<string, any>;
  status: string;
  talent_users?: {
    full_name: string;
    current_location?: string;
    profile_photo_url?: string;
  };
  tier?: 'junior' | 'pro' | 'custom' | null;
  tier_custom?: string | null;
}

interface BusinessUser {
  id: string;
  company_name: string;
  contact_person_name: string;
  contact_email: string | null;
  contact_phone?: string | null;
  access_expires_at?: string;
  is_active: boolean;
  default_salesperson_id?: string | null;
}

export default function BusinessDetail({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'sharing'>('subscriptions');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [sharingCategory, setSharingCategory] = useState<string>('');
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Fetch business user info
  const { data: staffOptions } = useQuery<Array<{ id: string; name: string; email: string }>>({
    queryKey: ['admin-conversation-staff'],
    queryFn: async () => {
      const { data } = await api.get('/admin/conversations/staff-options');
      return data.staff ?? [];
    },
  });

  const setSalesperson = useMutation({
    mutationFn: async (staff_user_id: string | null) => {
      await api.patch(`/admin/conversations/business/${businessId}/salesperson`, { staff_user_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-business-user', businessId] });
      toast.success('Default salesperson saved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not save salesperson');
    },
  });

  const { data: businessUser } = useQuery<BusinessUser>({
    queryKey: ['admin-business-user', businessId],
    queryFn: async () => {
      const { data } = await api.get('/admin/users/business');
      const users = data.users ?? data;
      return users.find((u: any) => u.id === businessId);
    },
  });

  // Fetch all categories
  const { data: allCategories } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data.categories ?? data;
    },
  });

  // Fetch current subscriptions
  const { data: subscriptions, isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ['admin-business-subscriptions', businessId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/business/${businessId}/subscriptions`);
      return data.subscriptions ?? data;
    },
  });

  // Fetch shared profiles
  const { data: sharedProfiles, isLoading: sharingLoading } = useQuery<SharedProfile[]>({
    queryKey: ['admin-business-shared-profiles', businessId, sharingCategory],
    queryFn: async () => {
      const params = sharingCategory ? `?category_id=${sharingCategory}` : '';
      const { data } = await api.get(`/admin/business/${businessId}/shared-profiles${params}`);
      return data.shared_profiles ?? data;
    },
    enabled: activeTab === 'sharing',
  });

  // Fetch profiles for selected category (for sharing)
  const { data: availableProfiles } = useQuery<TalentProfile[]>({
    queryKey: ['admin-category-profiles', sharingCategory],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talents/categories/${sharingCategory}/profiles`);
      return data.profiles ?? data;
    },
    enabled: !!sharingCategory,
  });

  // Initialize selected categories from current subscriptions
  useEffect(() => {
    if (subscriptions) {
      setSelectedCategories(new Set(subscriptions.map((s) => s.category_id)));
    }
  }, [subscriptions]);

  // Initialize selected profiles from current shared profiles when category changes
  useEffect(() => {
    if (sharedProfiles && sharingCategory) {
      const profileIds = sharedProfiles
        .filter((sp) => sp.category_id === sharingCategory)
        .map((sp) => sp.talent_profile_id);
      setSelectedProfiles(new Set(profileIds));
    } else {
      setSelectedProfiles(new Set());
    }
  }, [sharedProfiles, sharingCategory]);

  // Mutations
  const saveSubscriptions = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/business/${businessId}/subscriptions`, {
        category_ids: Array.from(selectedCategories),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-business-subscriptions', businessId] });
      toast.success('Category subscriptions updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update subscriptions');
    },
  });

  const saveSharedProfiles = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/business/${businessId}/shared-profiles`, {
        profile_ids: Array.from(selectedProfiles),
        category_id: sharingCategory,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-business-shared-profiles', businessId] });
      toast.success('Shared profiles updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update shared profiles');
    },
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/admin/business/${businessId}/reset-password`, {});
      return data as { temporary_password: string };
    },
    onSuccess: (data) => {
      setTempPassword(data.temporary_password);
      toast.success('Password reset — share the temporary password with the user.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    },
  });

  function toggleCategory(categoryId: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function toggleProfile(profileId: string) {
    setSelectedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  // Subscribed categories for sharing dropdown
  const subscribedCategories = (allCategories ?? []).filter((c) =>
    selectedCategories.has(c.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/business')}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {businessUser?.company_name ?? 'Business User'}
            </h1>
            <p className="text-sm text-gray-500">
              {businessUser?.contact_email || businessUser?.contact_phone}

            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-500">Default salesperson</label>
          <select
            value={businessUser?.default_salesperson_id ?? ''}
            onChange={(e) => setSalesperson.mutate(e.target.value || null)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Use fallback</option>
            {(staffOptions ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        <Button
          onClick={() => {
            if (
              window.confirm(
                "Reset this business user's password? They'll receive a temporary password and must set a new one on next login.",
              )
            ) {
              resetPassword.mutate();
            }
          }}
          loading={resetPassword.isPending}
        >
          Reset password
        </Button>
        </div>
      </div>

      {tempPassword && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Temporary password</p>
          <p className="mt-1 font-mono text-lg tracking-wide text-amber-900">{tempPassword}</p>
          <p className="mt-1 text-xs text-amber-700">
            Share this with the user over WhatsApp. They&apos;ll be asked to set a new
            password when they log in. This won&apos;t be shown again.
          </p>
          <button
            onClick={() => setTempPassword(null)}
            className="mt-2 text-xs text-amber-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'subscriptions'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Category Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('sharing')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sharing'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile Sharing
        </button>
      </div>

      {/* Category Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Assign Categories
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Select the categories this business user can see after logging in.
          </p>

          {subsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(allCategories ?? []).map((cat) => (
                  <label
                    key={cat.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      selectedCategories.has(cat.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.has(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-gray-500 line-clamp-1">{cat.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => saveSubscriptions.mutate()}
                  loading={saveSubscriptions.isPending}
                >
                  Save Subscriptions
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Profile Sharing Tab */}
      {activeTab === 'sharing' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Share Profiles
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Select a category, then choose which profiles to share with this business user.
          </p>

          {/* Category selector */}
          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Select Category
            </label>
            <select
              value={sharingCategory}
              onChange={(e) => setSharingCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Choose a category...</option>
              {subscribedCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {subscribedCategories.length === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Save category subscriptions first to enable profile sharing.
              </p>
            )}
          </div>

          {/* Profiles list */}
          {sharingCategory && (
            <>
              {!availableProfiles?.length ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  No approved profiles found in this category.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {selectedProfiles.size} of {availableProfiles.length} profiles selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setSelectedProfiles(
                            new Set(availableProfiles.map((p) => p.id))
                          )
                        }
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedProfiles(new Set())}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {availableProfiles.map((profile) => (
                      <label
                        key={profile.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                          selectedProfiles.has(profile.id)
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProfiles.has(profile.id)}
                          onChange={() => toggleProfile(profile.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">
                              {profile.talent_users?.full_name ?? 'Unknown'}
                            </p>
                            <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />
                          </div>
                          <p className="text-xs text-gray-500">
                            {profile.talent_users?.current_location ?? 'No location'}
                            {profile.field_data?.designation && (
                              <span> — {profile.field_data.designation}</span>
                            )}
                          </p>
                        </div>
                        <Badge variant="green">Approved</Badge>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => saveSharedProfiles.mutate()}
                  loading={saveSharedProfiles.isPending}
                  disabled={!sharingCategory}
                >
                  Save Shared Profiles
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
