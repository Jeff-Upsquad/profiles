'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface PublicProfile {
  profile: {
    id: string;
    category_id: string;
    status: string;
    field_data: Record<string, any>;
    talent_users?: {
      full_name: string;
      profile_photo_url?: string;
      current_location?: string;
      languages_spoken?: string[];
    };
    categories?: { name: string; slug: string };
    portfolio_items?: {
      id: string;
      skill_name: string;
      file_url: string;
      file_type: string;
      file_name: string;
    }[];
  };
  fields: {
    id: string;
    field_key: string;
    field_label: string;
    field_type: string;
    is_active: boolean;
    sort_order: number;
    options?: { label: string; value: string }[];
  }[];
}

function PublicProfileView({ profileId }: { profileId: string }) {
  const { data, isLoading, error } = useQuery<PublicProfile>({
    queryKey: ['public-profile', profileId],
    queryFn: async () => {
      const { data } = await axios.get(`/api/public/profiles/${profileId}`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Profile Not Found</h2>
          <p className="text-sm text-gray-500">This profile doesn't exist or is not available.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { profile, fields: rawFields } = data;
  const talentUser = profile.talent_users;
  const sortedFields = (rawFields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const skills: { skill: string; level: number }[] = profile.field_data?._skills ?? [];
  const tools: string[] = profile.field_data?._tools ?? [];
  const aiTools: string[] = profile.field_data?._ai_tools ?? [];
  const planWages = profile.field_data?._plan_wages;

  const portfolioBySkill: Record<string, any[]> = {};
  for (const item of profile.portfolio_items ?? []) {
    if (!portfolioBySkill[item.skill_name]) portfolioBySkill[item.skill_name] = [];
    portfolioBySkill[item.skill_name].push(item);
  }

  const renderFieldValue = (field: any, value: any) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400 italic">Not provided</span>;
    }
    if (field.field_type === 'multi_select' && Array.isArray(value)) {
      const labels = (field.options ?? []).reduce(
        (acc: Record<string, string>, opt: any) => ({ ...acc, [opt.value]: opt.label }),
        {}
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
      const opt = (field.options ?? []).find((o: any) => o.value === value);
      return opt?.label || String(value);
    }
    if (field.field_type === 'currency') return `$${Number(value).toLocaleString()}`;
    return String(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="flex items-center gap-6">
            {talentUser?.profile_photo_url ? (
              <img
                src={talentUser.profile_photo_url}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
                {talentUser?.full_name?.charAt(0) ?? '?'}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{talentUser?.full_name}</h1>
              <p className="mt-1 text-lg text-indigo-600">{profile.categories?.name}</p>
              {talentUser?.current_location && (
                <p className="mt-1 text-sm text-gray-500">{talentUser.current_location}</p>
              )}
              {talentUser?.languages_spoken && talentUser.languages_spoken.length > 0 && (
                <p className="mt-1 text-sm text-gray-500">
                  Languages: {talentUser.languages_spoken.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {/* Profile Details */}
        {sortedFields.length > 0 && (
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

        {/* Plan Wages */}
        {planWages && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Plan Wages</h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              {planWages.hourly != null && (
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">Hourly Rate</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">${planWages.hourly}</dd>
                </div>
              )}
              {planWages.daily != null && (
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">Daily Rate</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">${planWages.daily}</dd>
                </div>
              )}
              {planWages.monthly != null && (
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">Monthly Rate</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">${planWages.monthly}</dd>
                </div>
              )}
            </dl>
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

        {/* Footer */}
        <div className="pb-8 text-center text-xs text-gray-400">
          Powered by SquadHire
        </div>
      </div>
    </div>
  );
}

export default function PublicProfilePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  return <PublicProfileView profileId={params.id} />;
}
