'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import { cleanPhoneForLink } from '@/lib/phone';

interface TalentUser {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  current_location?: string | null;
  native_place?: string | null;
  profile_photo_url?: string | null;
  languages_spoken?: { language: string; proficiency: string }[] | null;
  is_active: boolean;
  approval_status?: string | null;
  approved_at?: string | null;
  created_at: string;
}

interface BasicProfile {
  permanent_address?: string | null;
  current_address?: string | null;
  current_district?: string | null;
  city?: string | null;
  pin_code?: string | null;
  country?: string | null;
  state?: string | null;
  availability?: string[] | null;
  job_type?: string[] | null;
  employment_type?: string[] | null;
  virtual_office_hours?: { day: string; from: string; to: string }[] | null;
  expected_salary_monthly?: number | null;
  aadhaar_number?: string | null;
  aadhaar_file_url?: string | null;
  pan_number?: string | null;
  pan_file_url?: string | null;
  profile_picture_url?: string | null;
  bank_account_holder?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc_code?: string | null;
  bank_branch_name?: string | null;
  resume_url?: string | null;
}

interface ProfileSummary {
  id: string;
  category_id: string;
  status: string;
  is_active: boolean;
  updated_at: string;
  created_at: string;
  categories?: { name: string; slug: string };
}

type UserDetailResponse =
  | {
      kind: 'talent';
      user: TalentUser;
      basic: BasicProfile | null;
      profiles: ProfileSummary[];
    }
  | { kind: 'business'; user: { id: string } };

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending_review: 'yellow',
  rejected: 'red',
  draft: 'gray',
  inactive: 'gray',
  pending: 'yellow',
};

const PLACEHOLDER = <span className="italic text-gray-400">Not provided</span>;

const TITLE_CASE = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function formatDate(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return null;
  }
}

function formatCurrency(n?: number | null) {
  if (n === null || n === undefined) return null;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function formatLanguages(langs?: { language: string; proficiency: string }[] | null) {
  if (!langs || langs.length === 0) return null;
  return langs.map((l) => `${l.language} (${l.proficiency})`).join(', ');
}

function formatVirtualHours(
  hours?: { day: string; from: string; to: string }[] | null
): ReactNode {
  const filled = (hours ?? []).filter((h) => h.from && h.to);
  if (filled.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {filled.map((h, i) => (
        <li key={i} className="text-sm text-gray-900">
          <span className="font-medium">{TITLE_CASE(h.day)}</span>: {h.from} – {h.to}
        </li>
      ))}
    </ul>
  );
}

function FileLink({ url, label = 'View file' }: { url?: string | null; label?: string }) {
  if (!url) return PLACEHOLDER;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 hover:underline"
    >
      {label}
    </a>
  );
}

function Tags({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return PLACEHOLDER;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
        >
          {TITLE_CASE(it)}
        </span>
      ))}
    </div>
  );
}

interface FieldRow {
  label: string;
  value: ReactNode | string | number | null | undefined;
}

function Section({ title, rows }: { title: string; rows: FieldRow[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {label}
            </dt>
            <dd className="mt-1 text-sm text-gray-900 break-words">
              {isEmpty(value as unknown) ? PLACEHOLDER : (value as ReactNode)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function UserDetail({ userId }: { userId: string }) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery<UserDetailResponse>({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/users/${userId}`);
      return data;
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (data?.kind === 'business') {
      router.replace(`/business/${data.user.id}`);
    }
  }, [data, router]);

  if (isLoading || data?.kind === 'business') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data || data.kind !== 'talent') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
        <p className="text-lg font-medium">User not found</p>
        <button
          onClick={() => router.push('/users')}
          className="mt-4 text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to Users
        </button>
      </div>
    );
  }

  const { user, basic, profiles } = data;
  const waPhone = cleanPhoneForLink(user.phone ?? undefined);
  const whatsappHref = waPhone ? `https://wa.me/${waPhone}` : null;
  const photoUrl = basic?.profile_picture_url ?? user.profile_photo_url ?? null;

  const personal: FieldRow[] = [
    { label: 'Full Name', value: user.full_name },
    { label: 'Phone', value: user.phone },
    { label: 'Email', value: user.email },
    { label: 'Age', value: user.age },
    { label: 'Gender', value: user.gender ? TITLE_CASE(user.gender) : null },
    { label: 'Native Place', value: user.native_place },
    { label: 'Languages', value: formatLanguages(user.languages_spoken) },
  ];

  const address: FieldRow[] = [
    { label: 'Current Location', value: user.current_location },
    { label: 'Country', value: basic?.country },
    { label: 'State', value: basic?.state },
    { label: 'District', value: basic?.current_district },
    { label: 'City', value: basic?.city },
    { label: 'Pin Code', value: basic?.pin_code },
    { label: 'Current Address', value: basic?.current_address },
    { label: 'Permanent Address', value: basic?.permanent_address },
  ];

  const work: FieldRow[] = [
    {
      label: 'Employment Type',
      value: <Tags items={basic?.employment_type ?? null} />,
    },
    {
      label: 'Availability',
      value: <Tags items={basic?.availability ?? null} />,
    },
    {
      label: 'Job Type',
      value: <Tags items={basic?.job_type ?? null} />,
    },
    {
      label: 'Expected Salary (Monthly)',
      value: formatCurrency(basic?.expected_salary_monthly),
    },
    {
      label: 'Virtual Office Hours',
      value: formatVirtualHours(basic?.virtual_office_hours),
    },
  ];

  const id: FieldRow[] = [
    { label: 'Aadhaar Number', value: basic?.aadhaar_number },
    {
      label: 'Aadhaar File',
      value: <FileLink url={basic?.aadhaar_file_url ?? null} />,
    },
    { label: 'PAN Number', value: basic?.pan_number },
    { label: 'PAN File', value: <FileLink url={basic?.pan_file_url ?? null} /> },
  ];

  const bank: FieldRow[] = [
    { label: 'Account Holder', value: basic?.bank_account_holder },
    { label: 'Bank Name', value: basic?.bank_name },
    { label: 'Account Number', value: basic?.bank_account_number },
    { label: 'IFSC Code', value: basic?.bank_ifsc_code },
    { label: 'Branch', value: basic?.bank_branch_name },
  ];

  const account: FieldRow[] = [
    { label: 'Joined', value: formatDate(user.created_at) },
    {
      label: 'Approval Status',
      value: user.approval_status ? (
        <Badge variant={statusVariant[user.approval_status] ?? 'gray'}>
          {TITLE_CASE(user.approval_status)}
        </Badge>
      ) : null,
    },
    { label: 'Approved At', value: formatDate(user.approved_at) },
    {
      label: 'Public Visibility',
      value: user.is_active ? (
        <Badge variant="green">Visible</Badge>
      ) : (
        <Badge variant="gray">Hidden</Badge>
      ),
    },
    { label: 'Resume', value: <FileLink url={basic?.resume_url ?? null} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={user.full_name}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-2xl font-semibold text-gray-400 ring-2 ring-gray-200">
              {user.full_name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <button
              onClick={() => router.push('/users')}
              className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
            >
              &larr; Back to Users
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{user.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {user.approval_status && (
                <Badge variant={statusVariant[user.approval_status] ?? 'gray'}>
                  {TITLE_CASE(user.approval_status)}
                </Badge>
              )}
              {!user.is_active && <Badge variant="gray">Hidden from public</Badge>}
            </div>
          </div>
        </div>
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
      </div>

      <Section title="Personal Information" rows={personal} />
      <Section title="Address" rows={address} />
      <Section title="Employment Preferences" rows={work} />
      <Section title="Identity Documents" rows={id} />
      <Section title="Bank Details" rows={bank} />
      <Section title="Account" rows={account} />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Profiles Created ({profiles.length})
          </h2>
        </div>
        {profiles.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            No profiles created yet
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Visibility</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profiles.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/talents/${p.category_id}/${p.id}`)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {p.categories?.name ?? '-'}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariant[p.status] ?? 'gray'}>
                      {p.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {p.is_active ? (
                      <Badge variant="green">Active</Badge>
                    ) : (
                      <Badge variant="gray">Hidden</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
