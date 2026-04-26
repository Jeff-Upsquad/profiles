import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface ProfileData {
  id: string;
  category_id: string;
  status: string;
  is_active: boolean;
  field_data: Record<string, any>;
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
    profile_photo_url?: string;
    is_active?: boolean;
  };
  categories?: { name: string; slug: string };
  portfolio_items?: {
    id: string;
    skill_name: string;
    file_url: string;
    file_type: string;
    file_name: string;
  }[];
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

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending_review: 'yellow',
  rejected: 'red',
  draft: 'gray',
  inactive: 'gray',
};

export default function TalentProfileView({
  categoryId,
  profileId,
}: {
  categoryId: string;
  profileId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['talent-profile', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talents/profiles/${profileId}`);
      return data.profile ?? data;
    },
    enabled: !!profileId,
  });

  const setProfileActive = useMutation({
    mutationFn: async (isActive: boolean) => {
      await api.patch(`/admin/talents/profiles/${profileId}/active`, { is_active: isActive });
    },
    onSuccess: (_data, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['talent-profile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['talent-profiles'] });
      toast.success(isActive ? 'Profile visible to public' : 'Profile hidden from public');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update visibility');
    },
  });

  const { data: fields } = useQuery<CategoryField[]>({
    queryKey: ['category-fields', profile?.category_id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${profile!.category_id}/fields`);
      return data.fields ?? data;
    },
    enabled: !!profile?.category_id,
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
    if (field.field_type === 'currency') return `$${Number(value).toLocaleString()}`;
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

  const sortedFields = (fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const talentUser = profile.talent_users;
  const skills: { skill: string; level: number }[] = profile.field_data?._skills ?? [];
  const tools: string[] = profile.field_data?._tools ?? [];
  const aiTools: string[] = profile.field_data?._ai_tools ?? [];
  // Group portfolio by skill
  const portfolioBySkill: Record<string, any[]> = {};
  for (const item of profile.portfolio_items ?? []) {
    if (!portfolioBySkill[item.skill_name]) portfolioBySkill[item.skill_name] = [];
    portfolioBySkill[item.skill_name].push(item);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push(`/talents/${categoryId}`)}
            className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
          >
            &larr; Back to List
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {talentUser?.full_name ?? 'Profile'}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{profile.categories?.name}</span>
            <Badge variant={statusVariant[profile.status] ?? 'gray'}>
              {profile.status.replace('_', ' ')}
            </Badge>
            {!profile.is_active && <Badge variant="gray">Hidden from public</Badge>}
            {talentUser?.is_active === false && (
              <Badge variant="gray">Talent account hidden</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={profile.is_active ? 'secondary' : 'primary'}
            size="sm"
            loading={setProfileActive.isPending}
            onClick={() => setProfileActive.mutate(!profile.is_active)}
          >
            {profile.is_active ? 'Mark Inactive' : 'Mark Active'}
          </Button>
          <button
            onClick={() => router.push(`/talents/${categoryId}/${profileId}/preview`)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Public View
          </button>
        </div>
      </div>

      {/* Personal Info */}
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
              ['Languages', (talentUser.languages_spoken ?? []).map((l: any) => `${l.language} (${l.proficiency})`).join(', ')],
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

      {/* Profile Fields */}
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

      {/* Skills */}
      {skills.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Skill Sets</h2>
          <div className="space-y-2">
            {skills.map((s) => (
              <div key={s.skill} className="flex items-center gap-3">
                <span className="w-40 text-sm font-medium text-gray-700">{s.skill}</span>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(s.level / 10) * 100}%` }} />
                  </div>
                </div>
                <span className="w-8 text-center text-sm font-semibold text-indigo-600">{s.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Tools</h2>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <span key={tool} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Tools */}
      {aiTools.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">AI Tools</h2>
          <div className="flex flex-wrap gap-2">
            {aiTools.map((tool) => (
              <span key={tool} className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio */}
      {Object.keys(portfolioBySkill).length > 0 && (
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
      )}
    </div>
  );
}
