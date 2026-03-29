import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface ReviewProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: string;
  field_data: Record<string, any>;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  talent_users?: {
    full_name: string;
    phone: string;
    age: number;
    gender: string;
    current_location: string;
    native_place: string;
    languages_spoken: string[];
  };
  categories?: { name: string; slug: string };
}

interface CategoryField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_active: boolean;
  sort_order: number;
  options?: { label: string; value: string }[];
}

export default function ProfileReview({ profileId }: { profileId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: profile, isLoading } = useQuery<ReviewProfile>({
    queryKey: ['review', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/reviews/${profileId}`);
      return data.profile ?? data;
    },
    enabled: !!profileId,
  });

  const { data: fields } = useQuery<CategoryField[]>({
    queryKey: ['category-fields', profile?.category_id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${profile!.category_id}/fields`);
      return data.fields ?? data;
    },
    enabled: !!profile?.category_id,
  });

  const approve = useMutation({
    mutationFn: async () => {
      await api.patch(`/admin/reviews/${profileId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Profile approved');
      router.push('/reviews');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve');
    },
  });

  const reject = useMutation({
    mutationFn: async (reason: string) => {
      await api.patch(`/admin/reviews/${profileId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Profile rejected');
      router.push('/reviews');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject');
    },
  });

  const renderFieldValue = (field: CategoryField, value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>;
    }

    if (field.field_type === 'multi_select' && Array.isArray(value)) {
      const labels = (field.options ?? []).reduce(
        (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
        {} as Record<string, string>
      );
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v: string) => (
            <span key={v} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
              {labels[v] || v}
            </span>
          ))}
        </div>
      );
    }

    if (field.field_type === 'select') {
      const opt = (field.options ?? []).find((o) => o.value === value);
      return opt?.label || String(value);
    }

    if (field.field_type === 'currency') {
      return `$${Number(value).toLocaleString()}`;
    }

    if (field.field_type === 'file_upload') {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
          View File
        </a>
      );
    }

    return String(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
        <p className="text-lg font-medium">Profile not found</p>
      </div>
    );
  }

  const sortedFields = (fields ?? [])
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const talentUser = profile.talent_users;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/reviews')}
            className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
          >
            &larr; Back to Queue
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Review: {talentUser?.full_name ?? 'Profile'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Category: {profile.categories?.name ?? 'N/A'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => setRejectModalOpen(true)}
          >
            Reject
          </Button>
          <Button
            loading={approve.isPending}
            onClick={() => approve.mutate()}
          >
            Approve
          </Button>
        </div>
      </div>

      {/* Talent User Info */}
      {talentUser && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Personal Information</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Full Name', talentUser.full_name],
              ['Phone', talentUser.phone],
              ['Age', talentUser.age],
              ['Gender', talentUser.gender],
              ['Location', talentUser.current_location],
              ['Native Place', talentUser.native_place],
              ['Languages', (talentUser.languages_spoken ?? []).join(', ')],
            ]
              .filter(([, val]) => val)
              .map(([label, val]) => (
                <div key={String(label)}>
                  <dt className="text-xs font-medium uppercase text-gray-500">{String(label)}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{String(val)}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      {/* Profile Field Data */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Details</h2>
        <dl className="divide-y divide-gray-100">
          {sortedFields.map((field) => (
            <div key={field.id} className="py-3 sm:flex sm:gap-4">
              <dt className="text-sm font-medium text-gray-500 sm:w-1/3">{field.field_label}</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:w-2/3">
                {renderFieldValue(field, profile.field_data?.[field.field_key])}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Skills & Tools */}
      {(profile.field_data?._skills?.length > 0 || profile.field_data?._tools?.length > 0) && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          {profile.field_data?._skills?.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Skill Sets</h2>
              <div className="space-y-2">
                {profile.field_data._skills.map((s: { skill: string; level: number }) => (
                  <div key={s.skill} className="flex items-center gap-3">
                    <span className="w-40 text-sm font-medium text-gray-700">{s.skill}</span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-indigo-600"
                          style={{ width: `${(s.level / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-center text-sm font-semibold text-indigo-600">{s.level}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {profile.field_data?._tools?.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Tools</h2>
              <div className="flex flex-wrap gap-2">
                {profile.field_data._tools.map((tool: string) => (
                  <span
                    key={tool}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Tools */}
      {profile.field_data?._ai_tools?.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">AI Tools</h2>
          <div className="flex flex-wrap gap-2">
            {profile.field_data._ai_tools.map((tool: string) => (
              <span
                key={tool}
                className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Plan Wages */}
      {profile.field_data?._plan_wages && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Plan Wages</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            {profile.field_data._plan_wages.hourly != null && (
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Hourly Rate</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">${profile.field_data._plan_wages.hourly}</dd>
              </div>
            )}
            {profile.field_data._plan_wages.daily != null && (
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Daily Rate</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">${profile.field_data._plan_wages.daily}</dd>
              </div>
            )}
            {profile.field_data._plan_wages.monthly != null && (
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Monthly Rate</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900">${profile.field_data._plan_wages.monthly}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Portfolio */}
      {(profile as any).portfolio_items?.length > 0 && (() => {
        const portfolioBySkill: Record<string, any[]> = {};
        for (const item of (profile as any).portfolio_items) {
          if (!portfolioBySkill[item.skill_name]) portfolioBySkill[item.skill_name] = [];
          portfolioBySkill[item.skill_name].push(item);
        }
        return (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Portfolio</h2>
            <div className="space-y-6">
              {Object.entries(portfolioBySkill).map(([skillName, items]) => (
                <div key={skillName}>
                  <h3 className="mb-3 text-sm font-semibold text-gray-700">{skillName}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item: any) => (
                      <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                        {item.file_type === 'image' && (
                          <img src={item.file_url} alt={item.file_name} className="mb-2 h-32 w-full rounded-md object-cover" />
                        )}
                        {item.file_type === 'video' && (
                          <video src={item.file_url} controls className="mb-2 h-32 w-full rounded-md object-cover" />
                        )}
                        {item.file_type === 'pdf' && (
                          <div className="mb-2 flex h-32 items-center justify-center rounded-md bg-red-50">
                            <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <p className="truncate text-sm text-gray-700">{item.file_name}</p>
                        <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-indigo-600 hover:underline">
                          View
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Metadata */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Metadata</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Status</dt>
            <dd className="mt-1"><Badge variant="yellow">{profile.status}</Badge></dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900">{new Date(profile.created_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Last Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">{new Date(profile.updated_at).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Profile"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this profile. The talent will see this reason.
          </p>
          <textarea
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={reject.isPending}
              disabled={!rejectionReason.trim()}
              onClick={() => reject.mutate(rejectionReason)}
            >
              Reject Profile
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
