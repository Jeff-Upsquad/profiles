import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import TierBadge from '@/components/ui/TierBadge';
import { cleanPhoneForLink } from '@/lib/phone';

type Tier = 'junior' | 'pro' | 'elite' | 'custom';
const TIER_OPTIONS: { value: Tier | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'junior', label: 'Junior' },
  { value: 'pro', label: 'Pro' },
  { value: 'elite', label: 'Elite' },
  { value: 'custom', label: 'Custom' },
];

interface LinkedLead {
  id: string;
  form_type: 'creative' | 'accountant';
  status: string;
  created_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  profile_type: 'junior' | 'pro' | 'elite' | 'custom' | null;
  name: string;
}

interface ProfileData {
  id: string;
  category_id: string;
  status: string;
  is_active: boolean;
  tier: Tier | null;
  tier_custom: string | null;
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
  linked_leads?: LinkedLead[];
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

  const setTier = useMutation({
    mutationFn: async (payload: { tier: Tier | null; tier_custom: string | null }) => {
      await api.patch(`/admin/talents/profiles/${profileId}/tier`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-profile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['talent-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-leads'] });
      toast.success('Tier updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update tier');
    },
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
  const waPhone = cleanPhoneForLink(talentUser?.phone);
  const whatsappHref = waPhone ? `https://wa.me/${waPhone}` : null;
  const skills: { skill: string; level: number }[] = profile.field_data?._skills ?? [];
  const tools: string[] = profile.field_data?._tools ?? [];
  const aiTools: string[] = profile.field_data?._ai_tools ?? [];
  const rawCategories: any[] = profile.field_data?._categories ?? [];
  const categories: { skill: string; level: number }[] = rawCategories
    .map((c) =>
      typeof c === 'string'
        ? { skill: c, level: 5 }
        : { skill: c.category ?? c.skill ?? '', level: c.level ?? 5 }
    )
    .filter((c) => c.skill)
    .sort((a, b) => b.level - a.level);
  const categoriesLabel =
    profile.categories?.slug === 'designer' ? 'Categories and Skills' : 'Categories';
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {talentUser?.full_name ?? 'Profile'}
            </h1>
            <TierBadge
              tier={profile.tier ?? profile.linked_leads?.[0]?.profile_type ?? null}
              tierCustom={profile.tier_custom}
            />
          </div>
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
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 shadow-sm hover:bg-green-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
          )}
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

      {/* Tier — admin override; writes to all of this talent's profiles */}
      <TierEditor
        currentTier={profile.tier}
        currentCustom={profile.tier_custom}
        inheritedTier={profile.linked_leads?.[0]?.profile_type ?? null}
        talentName={talentUser?.full_name ?? 'this talent'}
        isPending={setTier.isPending}
        onChange={(tier, tier_custom) => setTier.mutate({ tier, tier_custom })}
      />

      {/* Originated From — surfaces matching lead_submissions linked at signup */}
      {profile.linked_leads && profile.linked_leads.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Originated from {profile.linked_leads.length === 1 ? 'Candidate' : 'Candidates'}
          </h2>
          <ul className="space-y-3">
            {profile.linked_leads.map((lead) => (
              <li
                key={lead.id}
                className="flex items-start justify-between gap-4 rounded-lg bg-white p-4"
              >
                <div className="space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {lead.form_type === 'creative' ? 'Creative form' : 'Accountant form'}
                    </span>
                    <Badge variant={lead.status === 'archived' ? 'gray' : 'indigo'}>
                      {lead.status.replace(/_/g, ' ')}
                    </Badge>
                    {lead.profile_type && (
                      <Badge variant="green">{lead.profile_type}</Badge>
                    )}
                  </div>
                  <div className="text-gray-600">
                    Submitted {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                  {(lead.utm_source || lead.utm_campaign) && (
                    <div className="text-gray-500">
                      {[lead.utm_source, lead.utm_campaign].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <Link
                  href={`/leads/${lead.id}`}
                  className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  View lead →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Categories */}
      {categories.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{categoriesLabel}</h2>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.skill} className="flex items-center gap-3">
                <span className="w-40 text-sm font-medium text-gray-700">{c.skill}</span>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-indigo-600"
                      style={{ width: `${(c.level / 10) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-8 text-center text-sm font-semibold text-indigo-600">
                  {c.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

interface TierEditorProps {
  currentTier: Tier | null;
  currentCustom: string | null;
  inheritedTier: Tier | null;
  talentName: string;
  isPending: boolean;
  onChange: (tier: Tier | null, tier_custom: string | null) => void;
}

function TierEditor({
  currentTier,
  currentCustom,
  inheritedTier,
  talentName,
  isPending,
  onChange,
}: TierEditorProps) {
  const [customValue, setCustomValue] = useState(currentCustom ?? '');
  const [editingCustom, setEditingCustom] = useState(false);

  useEffect(() => {
    setCustomValue(currentCustom ?? '');
    setEditingCustom(false);
  }, [currentTier, currentCustom]);

  const handleClick = (value: Tier | null) => {
    if (value === currentTier && value !== 'custom') return;
    if (value === 'custom') {
      setEditingCustom(true);
      return;
    }
    setEditingCustom(false);
    onChange(value, null);
  };

  const saveCustom = () => {
    const trimmed = customValue.trim();
    if (!trimmed) {
      toast.error('Enter a custom label');
      return;
    }
    onChange('custom', trimmed);
    setEditingCustom(false);
  };

  const showInheritNote = currentTier === null && inheritedTier !== null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Tier</h2>
        <TierBadge tier={currentTier ?? inheritedTier} tierCustom={currentCustom} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TIER_OPTIONS.map((opt) => {
          const active =
            opt.value === currentTier ||
            (opt.value === 'custom' && editingCustom);
          return (
            <button
              key={opt.value ?? 'none'}
              type="button"
              onClick={() => handleClick(opt.value)}
              disabled={isPending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                active
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200 ring-offset-1'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50`}
            >
              {opt.label}
              {opt.value === 'custom' && currentTier === 'custom' && currentCustom && (
                <span className="ml-1 text-indigo-500">· {currentCustom}</span>
              )}
            </button>
          );
        })}
      </div>

      {editingCustom && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveCustom();
              }
            }}
            placeholder="e.g. Specialist"
            maxLength={100}
            autoFocus
            className="block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={saveCustom}
            disabled={isPending}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCustom(false);
              setCustomValue(currentCustom ?? '');
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-500">
        {showInheritNote ? (
          <>Currently inherited from candidate. Setting a tier here updates all of {talentName}&rsquo;s profiles and overrides the candidate tier.</>
        ) : (
          <>Updates tier for all of {talentName}&rsquo;s profiles. Set to None to inherit from the candidate record.</>
        )}
      </p>
    </div>
  );
}
