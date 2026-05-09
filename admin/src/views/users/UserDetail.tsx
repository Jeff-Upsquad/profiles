'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { cleanPhoneForLink } from '@/lib/phone';
import { useUserActions } from './useUserActions';

interface TalentUser {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  profile_photo_url?: string | null;
  languages_spoken?: { language: string; proficiency: string }[] | null;
  is_active: boolean;
  suspended?: boolean;
  approval_status?: string | null;
  approved_at?: string | null;
  created_at: string;
}

interface EducationEntry {
  from_year: number;
  from_month: number;
  to_year: number;
  to_month: number;
  course_name: string;
  institution: string;
}

interface BasicProfile {
  permanent_address?: string | null;
  permanent_country?: string | null;
  permanent_state?: string | null;
  permanent_district?: string | null;
  permanent_city?: string | null;
  permanent_pin_code?: string | null;
  current_address?: string | null;
  country?: string | null;
  state?: string | null;
  current_district?: string | null;
  city?: string | null;
  pin_code?: string | null;
  availability?: string[] | null;
  job_type?: string[] | null;
  employment_type?: string[] | null;
  virtual_office_hours?: { day: string; from: string; to: string }[] | null;
  education_courses?: EducationEntry[] | null;
  expected_salary_monthly?: number | null;
  expected_salary_full_time?: number | null;
  expected_salary_part_time?: number | null;
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

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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

function formatMonthYear(month?: number, year?: number) {
  if (!month || !year) return '';
  return `${MONTHS_SHORT[month - 1] ?? ''} ${year}`;
}

function splitName(fullName?: string | null) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', middle: '', last: '' };
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
  if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
  };
}

function formatLanguages(
  langs?: { language: string; proficiency: string }[] | null
): ReactNode {
  if (!langs || langs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {langs.map((l, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
        >
          {l.language}
          <span className="text-indigo-400">·</span>
          <span className="text-indigo-600">{TITLE_CASE(l.proficiency)}</span>
        </span>
      ))}
    </div>
  );
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

function formatEducation(entries?: EducationEntry[] | null): ReactNode {
  if (!entries || entries.length === 0) return null;
  return (
    <ul className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-sm font-semibold text-gray-900">
            {e.course_name || <span className="italic text-gray-400">Untitled course</span>}
          </div>
          {e.institution && (
            <div className="mt-0.5 text-sm text-gray-700">{e.institution}</div>
          )}
          <div className="mt-1 text-xs text-gray-500">
            {formatMonthYear(e.from_month, e.from_year)} – {formatMonthYear(e.to_month, e.to_year)}
          </div>
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

function FieldGrid({ rows }: { rows: FieldRow[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}

function Section({ title, rows }: { title: string; rows: FieldRow[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">{title}</h2>
      <FieldGrid rows={rows} />
    </div>
  );
}

function PreferenceSection({
  title,
  selected,
  rows,
}: {
  title: string;
  selected: boolean;
  rows: FieldRow[];
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white px-5 py-4 ${
        selected ? '' : 'opacity-60'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <Badge variant={selected ? 'green' : 'gray'}>
          {selected ? 'Selected' : 'Not selected'}
        </Badge>
      </div>
      <FieldGrid rows={rows} />
    </div>
  );
}

function AddressSection({
  permanent,
  current,
}: {
  permanent: FieldRow[];
  current: FieldRow[];
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Address</h2>
      <div>
        <h3 className="mb-3 text-base font-semibold text-gray-900">Official Address</h3>
        <FieldGrid rows={permanent} />
      </div>
      <div className="mt-5 border-t border-gray-200 pt-4">
        <h3 className="mb-3 text-base font-semibold text-gray-900">Current Address</h3>
        <FieldGrid rows={current} />
      </div>
    </div>
  );
}

function ProfilePictureSection({ url }: { url?: string | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Profile Picture</h2>
      {url ? (
        <div className="flex items-center gap-4">
          <img
            src={url}
            alt="Profile"
            className="h-24 w-24 rounded-xl object-cover ring-1 ring-gray-200"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:underline"
          >
            View original
          </a>
        </div>
      ) : (
        <div className="text-sm">{PLACEHOLDER}</div>
      )}
    </div>
  );
}

function JobProfileCards({ profiles }: { profiles: ProfileSummary[] }) {
  const router = useRouter();
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">
        Job Profiles ({profiles.length})
      </h2>
      {profiles.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No job profiles created yet
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => {
            const isLive = p.status === 'approved';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/talents/${p.category_id}/${p.id}`)}
                className="group flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 break-words">
                    {p.categories?.name ?? 'Profile'}
                  </h3>
                  {isLive && (
                    <span className="flex-shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 ring-1 ring-inset ring-green-200">
                      Live
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={statusVariant[p.status] ?? 'gray'}>
                    {p.status.replace('_', ' ')}
                  </Badge>
                  {!p.is_active && p.status !== 'inactive' && (
                    <Badge variant="gray">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CourseEnrollment {
  course_id: string;
  course_title: string;
  countdown_hours: number | null;
  started_at: string;
  expires_at: string | null;
  expired: boolean;
}

export default function UserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { suspendUser, setUserActive, deleteUser } = useUserActions();

  const { data, isLoading, error } = useQuery<UserDetailResponse>({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/users/${userId}`);
      return data;
    },
    enabled: !!userId,
  });

  const { data: enrollmentsData } = useQuery<{ enrollments: CourseEnrollment[] }>({
    queryKey: ['admin-user-enrollments', userId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/training/users/${userId}/enrollments`);
      return data;
    },
    enabled: !!userId,
  });
  const enrollments = enrollmentsData?.enrollments ?? [];

  const reopenCourse = useMutation({
    mutationFn: async (courseId: string) => {
      await api.delete(`/admin/training/users/${userId}/enrollments/${courseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-enrollments', userId] });
      toast.success('Course reopened — user will see the Start button again');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reopen course');
    },
  });

  const handleDelete = () => {
    if (
      window.confirm(
        'Are you sure you want to permanently delete this user? This action cannot be undone.',
      )
    ) {
      deleteUser.mutate(userId, {
        onSuccess: () => router.push('/users'),
      });
    }
  };

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
  const crmHref = waPhone ? `https://shcrm.squadhub.in/app/leads/lookup?phone=${waPhone}` : null;
  const photoUrl = basic?.profile_picture_url ?? user.profile_photo_url ?? null;

  const wantsSalary = (basic?.employment_type ?? []).includes('salary');
  const wantsFreelance = (basic?.employment_type ?? []).includes('freelance');
  const name = splitName(user.full_name);

  // 1. Basic Details (mirrors talent Section 1)
  const basicDetails: FieldRow[] = [
    { label: 'First Name', value: name.first },
    { label: 'Middle Name', value: name.middle },
    { label: 'Last Name', value: name.last },
    { label: 'Email', value: user.email },
    { label: 'Phone Number', value: user.phone },
    {
      label: 'Work Preference',
      value: <Tags items={basic?.employment_type ?? null} />,
    },
  ];

  // 2. Language (mirrors talent Section 2)
  const languageRows: FieldRow[] = [
    { label: 'Languages Spoken', value: formatLanguages(user.languages_spoken) },
  ];

  // 3. Address (mirrors talent Section 3)
  const officialAddressRows: FieldRow[] = [
    { label: 'Address', value: basic?.permanent_address },
    { label: 'Country', value: basic?.permanent_country },
    { label: 'State', value: basic?.permanent_state },
    { label: 'District', value: basic?.permanent_district },
    { label: 'City', value: basic?.permanent_city },
    { label: 'PIN Code', value: basic?.permanent_pin_code },
  ];

  const currentAddressRows: FieldRow[] = [
    { label: 'Address', value: basic?.current_address },
    { label: 'Country', value: basic?.country },
    { label: 'State', value: basic?.state },
    { label: 'District', value: basic?.current_district },
    { label: 'City', value: basic?.city },
    { label: 'PIN Code', value: basic?.pin_code },
  ];

  // 4. Job Preference (mirrors talent Section 4)
  const jobPrefs: FieldRow[] = [
    { label: 'Availability', value: <Tags items={basic?.availability ?? null} /> },
    { label: 'Job Type', value: <Tags items={basic?.job_type ?? null} /> },
    {
      label: 'Expected Salary (Full-time)',
      value: formatCurrency(basic?.expected_salary_full_time),
    },
    {
      label: 'Expected Salary (Part-time)',
      value: formatCurrency(basic?.expected_salary_part_time),
    },
    ...(basic?.expected_salary_monthly != null
      ? [
          {
            label: 'Expected Salary (Monthly, legacy)',
            value: formatCurrency(basic.expected_salary_monthly),
          },
        ]
      : []),
  ];

  // 5. Education & Courses (mirrors talent Section 5)
  const educationRows: FieldRow[] = [
    { label: 'Courses', value: formatEducation(basic?.education_courses) },
  ];

  // 6. Freelance Preference (mirrors talent Section 6)
  const freelancePrefs: FieldRow[] = [
    {
      label: 'Virtual Office Hours',
      value: formatVirtualHours(basic?.virtual_office_hours),
    },
  ];

  // 7. ID Proofs (mirrors talent Section 7)
  const idProofs: FieldRow[] = [
    { label: 'Aadhaar Number', value: basic?.aadhaar_number },
    {
      label: 'Aadhaar Card Copy',
      value: <FileLink url={basic?.aadhaar_file_url ?? null} />,
    },
    { label: 'PAN Number', value: basic?.pan_number },
    {
      label: 'PAN Card Copy',
      value: <FileLink url={basic?.pan_file_url ?? null} />,
    },
  ];

  // 9. Bank Account (mirrors talent Section 9)
  const bankAccount: FieldRow[] = [
    { label: 'Account Holder Name', value: basic?.bank_account_holder },
    { label: 'Bank Name', value: basic?.bank_name },
    { label: 'Account Number', value: basic?.bank_account_number },
    { label: 'IFSC Code', value: basic?.bank_ifsc_code },
    { label: 'Branch Name', value: basic?.bank_branch_name },
  ];

  // 10. Resume (mirrors talent Section 10)
  const resumeRows: FieldRow[] = [
    { label: 'Resume', value: <FileLink url={basic?.resume_url ?? null} label="View resume" /> },
  ];

  // Account status — admin metadata, not part of basic profile
  const accountStatus: FieldRow[] = [
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
        <Badge variant="green">Active</Badge>
      ) : (
        <Badge variant="gray">Inactive</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
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
              {!user.is_active && <Badge variant="gray">Inactive</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {crmHref && (
            <a
              href={crmHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
              Open in CRM
            </a>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={setUserActive.isPending}
            onClick={() =>
              setUserActive.mutate({ userId: user.id, isActive: !user.is_active })
            }
          >
            {user.is_active ? 'Mark Inactive' : 'Mark Active'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={suspendUser.isPending}
            onClick={() =>
              suspendUser.mutate({ userId: user.id, suspend: !user.suspended })
            }
          >
            {user.suspended ? 'Unsuspend' : 'Suspend'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={deleteUser.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      <JobProfileCards profiles={profiles} />

      <Section title="Basic Details" rows={basicDetails} />
      <Section title="Language" rows={languageRows} />
      <AddressSection permanent={officialAddressRows} current={currentAddressRows} />
      <PreferenceSection
        title="Job Preference"
        selected={wantsSalary}
        rows={jobPrefs}
      />
      <Section title="Education & Courses" rows={educationRows} />
      <PreferenceSection
        title="Freelance Preference"
        selected={wantsFreelance}
        rows={freelancePrefs}
      />
      <Section title="ID Proofs" rows={idProofs} />
      <ProfilePictureSection url={photoUrl} />
      <Section title="Bank Account" rows={bankAccount} />
      <Section title="Resume" rows={resumeRows} />
      <Section title="Account Status" rows={accountStatus} />

      {enrollments.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Course Enrollments ({enrollments.length})
            </h2>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Course</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Started</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {enrollments.map((e) => (
                <tr key={e.course_id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{e.course_title}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(e.started_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{e.expires_at ? new Date(e.expires_at).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <Badge variant={e.expired ? 'red' : 'green'}>
                      {e.expired ? 'Expired' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {e.expired && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={reopenCourse.isPending && reopenCourse.variables === e.course_id}
                        onClick={() => {
                          if (window.confirm('Reopen this course? The user will see the Start button again and get a fresh countdown timer.')) {
                            reopenCourse.mutate(e.course_id);
                          }
                        }}
                      >
                        Reopen
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
