import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProfile, usePortfolioItems } from '@/hooks/useProfiles';
import { useCategoryWithFields } from '@/hooks/useCategories';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';

export default function ProfileView({ profileId }: { profileId: string }) {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile(profileId);
  const { data: categoryWithFields } = useCategoryWithFields(profile?.category?.slug);
  const { data: portfolioItems } = usePortfolioItems(profileId);

  if (profileLoading) {
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

  const fields = (categoryWithFields?.fields ?? [])
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const canEdit = profile.status === 'draft' || profile.status === 'rejected' || profile.status === 'approved' || profile.status === 'pending_review';

  const skills: { skill: string; level: number }[] = profile.field_data?._skills ?? [];
  const tools: string[] = profile.field_data?._tools ?? [];
  const aiTools: string[] = profile.field_data?._ai_tools ?? [];
  const planWages = profile.field_data?._plan_wages;

  // Group portfolio by skill
  const portfolioBySkill: Record<string, any[]> = {};
  for (const item of portfolioItems ?? []) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/talent/profiles')}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.category?.name ?? 'Profile'}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={statusToBadgeVariant(profile.status)}>
                {profile.status.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-gray-500">
                Created {new Date(profile.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Link href={`/talent/profiles/${profileId}/edit`}>
              <Button>Edit Profile</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Rejection Reason */}
      {profile.rejection_reason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="mb-1 text-sm font-semibold text-red-800">Rejection Reason</h3>
          <p className="text-sm text-red-700">{profile.rejection_reason}</p>
        </div>
      )}

      {/* Profile Details */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Details</h2>
        <dl className="divide-y divide-gray-100">
          {fields.map((field) => (
            <div key={field.id} className="py-3 sm:flex sm:gap-4">
              <dt className="text-sm font-medium text-gray-500 sm:w-1/3">{field.field_label}</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:w-2/3">
                {renderFieldValue(field, profile.field_data?.[field.field_key])}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Skills */}
      {skills.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Skill Sets</h2>
          <div className="space-y-2">
            {skills.map((s) => (
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
        </Card>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Tools</h2>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <span
                key={tool}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700"
              >
                {tool}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* AI Tools */}
      {aiTools.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">AI Tools</h2>
          <div className="flex flex-wrap gap-2">
            {aiTools.map((tool) => (
              <span
                key={tool}
                className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700"
              >
                {tool}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Plan Wages */}
      {planWages && (
        <Card>
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
        </Card>
      )}

      {/* Portfolio */}
      {Object.keys(portfolioBySkill).length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Portfolio</h2>
          <div className="space-y-6">
            {Object.entries(portfolioBySkill).map(([skillName, items]) => (
              <div key={skillName}>
                <h3 className="mb-3 text-sm font-semibold text-gray-700">{skillName}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item: any) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      {item.file_type === 'image' && (
                        <img
                          src={item.file_url}
                          alt={item.file_name}
                          className="mb-2 h-32 w-full rounded-md object-cover"
                        />
                      )}
                      {item.file_type === 'video' && (
                        <video
                          src={item.file_url}
                          controls
                          className="mb-2 h-32 w-full rounded-md object-cover"
                        />
                      )}
                      {item.file_type === 'pdf' && (
                        <div className="mb-2 flex h-32 items-center justify-center rounded-md bg-red-50">
                          <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <p className="truncate text-sm text-gray-700">{item.file_name}</p>
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-xs text-indigo-600 hover:underline"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
