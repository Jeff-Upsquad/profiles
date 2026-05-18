import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';
import Modal from '@/components/ui/Modal';
import toast from 'react-hot-toast';

interface LinkedLead {
  id: string;
  form_type: 'creative' | 'accountant';
  status: string;
  created_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  profile_type: 'junior' | 'pro' | 'elite' | 'Top Talents' | 'custom' | null;
  name: string;
}

interface ReviewProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: string;
  field_data: Record<string, any>;
  previous_field_data?: Record<string, any> | null;
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
    languages_spoken: { language: string; proficiency: string }[];
  };
  categories?: { name: string; slug: string };
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

/** Deep-compare two values (handles arrays, objects, primitives) */
function valuesChanged(a: any, b: any): boolean {
  if (a === b) return false;
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  if (typeof a !== typeof b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;
    return a.some((v, i) => valuesChanged(v, b[i]));
  }
  if (typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (valuesChanged(a[k], b[k])) return true;
    }
    return false;
  }
  return a !== b;
}

/** Returns a Set of top-level field_data keys that differ between current and previous */
function getChangedKeys(
  current: Record<string, any>,
  previous: Record<string, any> | null | undefined,
): Set<string> {
  if (!previous) return new Set();
  const changed = new Set<string>();
  const allKeys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  for (const key of allKeys) {
    if (valuesChanged(current[key], previous[key])) {
      changed.add(key);
    }
  }
  return changed;
}

/** Format a field value as plain text for the change note */
function formatPrevValue(field: CategoryField, value: any): string {
  if (value === undefined || value === null || value === '') return '(empty)';
  if (field.field_type === 'multi_select' && Array.isArray(value)) {
    return value
      .map((v: string) => (field.options ?? []).find((o) => o.value === v)?.label || v)
      .join(', ');
  }
  if (field.field_type === 'select') {
    return (field.options ?? []).find((o) => o.value === value)?.label || String(value);
  }
  if (field.field_type === 'currency') {
    return `$${Number(value).toLocaleString()}`;
  }
  return String(value);
}

/** Build a human-readable change summary for profile detail fields */
function buildFieldChangeNotes(
  fields: CategoryField[],
  current: Record<string, any>,
  prev: Record<string, any>,
  changedKeys: Set<string>,
): string[] {
  const notes: string[] = [];
  for (const field of fields) {
    if (!changedKeys.has(field.field_key)) continue;
    const oldVal = formatPrevValue(field, prev[field.field_key]);
    const newVal = formatPrevValue(field, current[field.field_key]);
    notes.push(`${field.field_label}: "${oldVal}" → "${newVal}"`);
  }
  return notes;
}

/** Build change notes for skills */
function buildSkillChangeNotes(
  current: { skill: string; level: number }[],
  previous: { skill: string; level: number }[] | undefined,
): string[] {
  if (!previous) return [];
  const notes: string[] = [];
  const prevMap = new Map(previous.map((s) => [s.skill, s.level]));
  const currMap = new Map(current.map((s) => [s.skill, s.level]));

  for (const [skill, level] of currMap) {
    if (!prevMap.has(skill)) {
      notes.push(`Added "${skill}" (level ${level})`);
    } else if (prevMap.get(skill) !== level) {
      notes.push(`"${skill}" level changed from ${prevMap.get(skill)} to ${level}`);
    }
  }
  for (const [skill] of prevMap) {
    if (!currMap.has(skill)) {
      notes.push(`Removed "${skill}"`);
    }
  }
  return notes;
}

/** Build change notes for a simple string array (tools, AI tools) */
function buildListChangeNotes(current: string[], previous: string[] | undefined): string[] {
  if (!previous) return [];
  const notes: string[] = [];
  const added = current.filter((t) => !previous.includes(t));
  const removed = previous.filter((t) => !current.includes(t));
  if (added.length) notes.push(`Added: ${added.join(', ')}`);
  if (removed.length) notes.push(`Removed: ${removed.join(', ')}`);
  return notes;
}

/** Build change notes for personal info (talent_users data stored in prev._user) */
function buildUserChangeNotes(
  current: ReviewProfile['talent_users'],
  prevUser: Record<string, any> | undefined,
): string[] {
  if (!current || !prevUser) return [];
  const notes: string[] = [];

  const simple: [string, string][] = [
    ['full_name', 'Full Name'],
    ['phone', 'Phone'],
    ['age', 'Age'],
    ['gender', 'Gender'],
    ['current_location', 'Location'],
    ['native_place', 'Native Place'],
  ];
  for (const [key, label] of simple) {
    const oldVal = prevUser[key];
    const newVal = (current as any)[key];
    if (oldVal != null && newVal != null && String(oldVal) !== String(newVal)) {
      notes.push(`${label}: "${oldVal}" → "${newVal}"`);
    } else if (oldVal == null && newVal != null) {
      notes.push(`${label}: added "${newVal}"`);
    } else if (oldVal != null && newVal == null) {
      notes.push(`${label}: removed (was "${oldVal}")`);
    }
  }

  // Languages
  const fmtLangs = (langs: { language: string; proficiency: string }[]) =>
    (langs ?? []).map((l) => `${l.language} (${l.proficiency})`).join(', ');
  const oldLangs = fmtLangs(prevUser.languages_spoken ?? []);
  const newLangs = fmtLangs(current.languages_spoken ?? []);
  if (oldLangs !== newLangs) {
    notes.push(`Languages: "${oldLangs || '(empty)'}" → "${newLangs || '(empty)'}"`);
  }

  return notes;
}

/** Build change notes for plan wages */
function buildWageChangeNotes(
  current: Record<string, number>,
  previous: Record<string, number> | undefined,
): string[] {
  if (!previous) return [];
  const notes: string[] = [];
  const labels: Record<string, string> = { hourly: 'Hourly', daily: 'Daily', monthly: 'Monthly' };
  for (const key of ['hourly', 'daily', 'monthly']) {
    if (current[key] != null && previous[key] != null && current[key] !== previous[key]) {
      notes.push(`${labels[key]}: $${previous[key]} → $${current[key]}`);
    } else if (current[key] != null && previous[key] == null) {
      notes.push(`${labels[key]}: added $${current[key]}`);
    } else if (current[key] == null && previous[key] != null) {
      notes.push(`${labels[key]}: removed (was $${previous[key]})`);
    }
  }
  return notes;
}

/** Red change note block shown under a section */
function ChangeNote({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5">
      <p className="mb-1 text-xs font-semibold uppercase text-red-700">Changes from previous version</p>
      <ul className="list-inside list-disc space-y-0.5">
        {notes.map((note, i) => (
          <li key={i} className="text-sm text-red-700">{note}</li>
        ))}
      </ul>
    </div>
  );
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
        {} as Record<string, string>,
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

  const prev = profile.previous_field_data;
  const changedKeys = getChangedKeys(profile.field_data ?? {}, prev);

  // Build change notes per section
  const userNotes = prev?._user ? buildUserChangeNotes(talentUser, prev._user) : [];
  const fieldChangeNotes = prev ? buildFieldChangeNotes(sortedFields, profile.field_data ?? {}, prev, changedKeys) : [];
  const skillNotes = prev && changedKeys.has('_skills') ? buildSkillChangeNotes(profile.field_data?._skills ?? [], prev._skills) : [];
  const toolNotes = prev && changedKeys.has('_tools') ? buildListChangeNotes(profile.field_data?._tools ?? [], prev._tools) : [];
  const aiToolNotes = prev && changedKeys.has('_ai_tools') ? buildListChangeNotes(profile.field_data?._ai_tools ?? [], prev._ai_tools) : [];
  const wageNotes = prev && changedKeys.has('_plan_wages') ? buildWageChangeNotes(profile.field_data?._plan_wages ?? {}, prev._plan_wages) : [];

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Review: {talentUser?.full_name ?? 'Profile'}
            </h1>
            {/* Latest tier from linked leads, sorted DESC by created_at on the API */}
            <TierBadge
              tier={profile.linked_leads?.[0]?.profile_type ?? null}
              tierCustom={null}
            />
          </div>
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
              ['Languages', (talentUser.languages_spoken ?? []).map((l) => `${l.language} (${l.proficiency})`).join(', ')],
            ]
              .filter(([, val]) => val)
              .map(([label, val]) => (
                <div key={String(label)}>
                  <dt className="text-xs font-medium uppercase text-gray-500">{String(label)}</dt>
                  <dd className="mt-1 text-sm text-gray-900">{String(val)}</dd>
                </div>
              ))}
          </dl>
          <ChangeNote notes={userNotes} />
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
        <ChangeNote notes={fieldChangeNotes} />
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
              <ChangeNote notes={skillNotes} />
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
              <ChangeNote notes={toolNotes} />
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
          <ChangeNote notes={aiToolNotes} />
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
          <ChangeNote notes={wageNotes} />
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
