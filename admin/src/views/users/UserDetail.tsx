'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DropdownMenu, { type DropdownMenuItem } from '@/components/ui/DropdownMenu';
import CandidateActivityPanel from '@/views/leads/CandidateActivityPanel';
import TierBadge from '@/components/ui/TierBadge';
import { cleanPhoneForLink, formatIndianPhone } from '@/lib/phone';
import { formatDate as formatLongDate } from '@/lib/formatDate';
import { useUserActions } from './useUserActions';
import EditBasicDetailsDialog from './edit-dialogs/EditBasicDetailsDialog';
import EditLanguagesDialog from './edit-dialogs/EditLanguagesDialog';
import EditAddressDialog from './edit-dialogs/EditAddressDialog';
import EditJobPreferenceDialog from './edit-dialogs/EditJobPreferenceDialog';
import EditEducationDialog from './edit-dialogs/EditEducationDialog';
import EditExperienceDialog from './edit-dialogs/EditExperienceDialog';
import EditFreelanceDialog from './edit-dialogs/EditFreelanceDialog';
import EditPartnerProgramDialog from './edit-dialogs/EditPartnerProgramDialog';
import EditIdProofsDialog from './edit-dialogs/EditIdProofsDialog';
import EditProfilePictureDialog from './edit-dialogs/EditProfilePictureDialog';
import EditBankAccountDialog from './edit-dialogs/EditBankAccountDialog';
import EditResumeDialog from './edit-dialogs/EditResumeDialog';

type EditTarget =
  | 'basic'
  | 'language'
  | 'address'
  | 'education'
  | 'experience'
  | 'jobPref'
  | 'freelance'
  | 'partner'
  | 'idProof'
  | 'profilePic'
  | 'bank'
  | 'resume';

interface TalentUser {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  profile_photo_url?: string | null;
  languages_spoken?: { language: string; proficiency: string }[] | null;
  is_active: boolean;
  suspended?: boolean;
  blacklisted?: boolean;
  approval_status?: string | null;
  approved_at?: string | null;
  skip_onboarding?: boolean;
  skip_onboarding_at?: string | null;
  skip_onboarding_reason?: string | null;
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

interface ExperienceEntry {
  from_year: number;
  from_month: number;
  to_year: number;
  to_month: number;
  company_name: string;
  designation: string;
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
  daily_available_hours?: { day: string; hours: number }[] | null;
  freelance_available?: boolean | null;
  education_courses?: EducationEntry[] | null;
  experience?: ExperienceEntry[] | null;
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
  tier?: string | null;
  tier_custom?: string | null;
  categories?: { name: string; slug: string };
}

type UserDetailResponse =
  | {
      kind: 'talent';
      user: TalentUser;
      basic: BasicProfile | null;
      profiles: ProfileSummary[];
      lead_id: string | null;
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
  return d ? formatLongDate(d) : null;
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

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_FULL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

function formatDailyHours(
  entries?: { day: string; hours: number }[] | null
): ReactNode {
  const filled = (entries ?? []).filter((d) => d.hours > 0);
  if (filled.length === 0) return null;
  const sorted = [...filled].sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
  );
  return (
    <ul className="space-y-0.5">
      {sorted.map((d, i) => (
        <li key={i} className="text-sm text-gray-900">
          <span className="font-medium">{DAY_FULL[d.day] ?? TITLE_CASE(d.day)}</span>: {d.hours} hrs
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

function formatExperience(entries?: ExperienceEntry[] | null): ReactNode {
  if (!entries || entries.length === 0) return null;
  return (
    <ul className="space-y-3">
      {entries.map((e, i) => (
        <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="text-sm font-semibold text-gray-900">
            {e.designation || <span className="italic text-gray-400">Untitled role</span>}
          </div>
          {e.company_name && (
            <div className="mt-0.5 text-sm text-gray-700">{e.company_name}</div>
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

/* ── Wizard icons (mirrors talent BasicProfileForm section icons) ── */
const svgIcon = (d: string, size = 'h-5 w-5') => (
  <svg className={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICON = {
  profiles: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  basic: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  language: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
  address: 'M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  education: 'M12 14l9-5-9-5-9 5 9 5zm0 0v6m6.16-9.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479',
  experience: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16',
  jobPref: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  freelance: 'M13 10V3L4 14h7v7l9-11h-7z',
  partner: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  idProof: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  profilePic: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm12 4a3 3 0 11-6 0 3 3 0 016 0z',
  bank: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
  resume: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  account: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  onboarding: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.247',
  enrollments: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
};

interface WizardSection {
  key: string;
  name: string;
  description: string;
  tint: string;
  iconPath: string;
  content: ReactNode;
  admin?: boolean;
  disabled?: boolean;
  complete?: boolean;
  onEdit?: () => void;
  trailing?: ReactNode;
  no?: number;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#f5f5f6]"
    >
      Edit
    </button>
  );
}

function WizardSectionHeader({ section }: { section: WizardSection }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div
          className={`${section.tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
          style={{ color: 'var(--tint-icon)' }}
        >
          {svgIcon(section.iconPath)}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-jakarta text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              {section.name}
            </h2>
            {section.admin && (
              <span className="rounded-full border border-[#0a0a0a] bg-[#FFFAC2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0a0a0a]">
                Admin section
              </span>
            )}
            {section.trailing}
          </div>
          <p className="mt-0.5 text-sm text-[#737373]">{section.description}</p>
        </div>
      </div>
      {section.onEdit && <EditButton onClick={section.onEdit} />}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#E7E7EA" strokeWidth="9" />
        <circle
          cx="50" cy="50" r="42" fill="none"
          stroke="url(#prog-grad)"
          strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 264} 264`}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="prog-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFF27A" />
            <stop offset="50%" stopColor="#0A0A0A" />
            <stop offset="100%" stopColor="#737373" />
          </linearGradient>
        </defs>
      </svg>
      <span className="font-jakarta text-base font-semibold tracking-[-0.02em] text-[#0a0a0a]">
        {pct}%
      </span>
    </div>
  );
}

function OnboardingBypassBody({
  user,
  isPending,
  onToggle,
}: {
  user: TalentUser;
  isPending: boolean;
  onToggle: (enabled: boolean, reason: string | null) => void;
}) {
  const [reasonDraft, setReasonDraft] = useState<string>(user.skip_onboarding_reason ?? '');
  const enabled = user.skip_onboarding === true;

  const handleToggle = (next: boolean) => {
    if (next) {
      const trimmed = reasonDraft.trim();
      onToggle(true, trimmed.length > 0 ? trimmed : null);
    } else {
      onToggle(false, null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-[#737373]">
          When enabled, this talent is treated as having completed the onboarding course
          and is not gated by it on the talent dashboard.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={() => handleToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            enabled ? 'bg-indigo-600' : 'bg-gray-200'
          } ${isPending ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {enabled ? (
          <Badge variant="indigo">Bypassed</Badge>
        ) : (
          <Badge variant="gray">Required</Badge>
        )}
        {enabled && user.skip_onboarding_at && (
          <span className="text-xs text-gray-500">
            set {formatDate(user.skip_onboarding_at)}
          </span>
        )}
      </div>

      {enabled && user.skip_onboarding_reason && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Reason:</span> {user.skip_onboarding_reason}
        </div>
      )}

      {!enabled && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-gray-600">
            Reason (optional — saved for audit)
          </label>
          <input
            type="text"
            value={reasonDraft}
            onChange={(e) => setReasonDraft(e.target.value)}
            placeholder="e.g. legacy approved talent, internal test account"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            maxLength={500}
          />
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
  const { suspendUser, blacklistUser, setUserActive, setOnboardingBypass, deleteUser } =
    useUserActions();
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [activityOpen, setActivityOpen] = useState(false);

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

  const { user, basic, profiles, lead_id: leadId } = data;
  const waPhone = cleanPhoneForLink(user.phone ?? undefined);
  const whatsappHref = waPhone ? `https://wa.me/${waPhone}` : null;
  const crmHref = waPhone ? `https://shcrm.squadhub.in/app/leads/lookup?phone=${waPhone}` : null;
  const photoUrl = basic?.profile_picture_url ?? user.profile_photo_url ?? null;

  const wantsSalary = (basic?.employment_type ?? []).includes('salary');
  const wantsFreelance = (basic?.employment_type ?? []).includes('freelance');
  const wantsPartner = (basic?.employment_type ?? []).includes('partner_program');
  const name = splitName(user.full_name);

  const basicDetails: FieldRow[] = [
    { label: 'First Name', value: name.first },
    { label: 'Middle Name', value: name.middle },
    { label: 'Last Name', value: name.last },
    { label: 'Email', value: user.email },
    { label: 'Phone Number', value: formatIndianPhone(user.phone) },
    { label: 'Work Preference', value: <Tags items={basic?.employment_type ?? null} /> },
  ];

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

  const jobPrefs: FieldRow[] = [
    { label: 'Availability', value: <Tags items={basic?.availability ?? null} /> },
    { label: 'Job Type', value: <Tags items={basic?.job_type ?? null} /> },
    { label: 'Expected Salary (Full-time)', value: formatCurrency(basic?.expected_salary_full_time) },
    { label: 'Expected Salary (Part-time)', value: formatCurrency(basic?.expected_salary_part_time) },
    ...(basic?.expected_salary_monthly != null
      ? [{ label: 'Expected Salary (Monthly, legacy)', value: formatCurrency(basic.expected_salary_monthly) }]
      : []),
  ];

  const idProofs: FieldRow[] = [
    { label: 'Aadhaar Number', value: basic?.aadhaar_number },
    { label: 'Aadhaar Card Copy', value: <FileLink url={basic?.aadhaar_file_url ?? null} /> },
    { label: 'PAN Number', value: basic?.pan_number },
    { label: 'PAN Card Copy', value: <FileLink url={basic?.pan_file_url ?? null} /> },
  ];

  const bankAccount: FieldRow[] = [
    { label: 'Account Holder Name', value: basic?.bank_account_holder },
    { label: 'Bank Name', value: basic?.bank_name },
    { label: 'Account Number', value: basic?.bank_account_number },
    { label: 'IFSC Code', value: basic?.bank_ifsc_code },
    { label: 'Branch Name', value: basic?.bank_branch_name },
  ];

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

  const selectedBadge = (selected: boolean) => (
    <Badge variant={selected ? 'green' : 'gray'}>{selected ? 'Selected' : 'Not selected'}</Badge>
  );

  // ── Build wizard sections ──
  const sections: WizardSection[] = [
    {
      key: 'profiles',
      name: 'Job Profiles',
      description: 'Job profiles this talent has created',
      tint: 'tint-purple',
      iconPath: ICON.profiles,
      admin: true,
      content:
        profiles.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No job profiles created yet</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => {
              const isLive = p.status === 'approved';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/talents/${p.category_id}/${p.id}`)}
                  className="group flex flex-col items-start gap-2 rounded-xl border-2 border-[#0a0a0a] bg-white p-4 text-left shadow-[var(--cu-shadow-brutal-sm)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--cu-shadow-brutal)]"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <h3 className="font-jakarta text-sm font-semibold text-gray-900 break-words">
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
                    <TierBadge tier={p.tier} tierCustom={p.tier_custom} />
                    {!p.is_active && p.status !== 'inactive' && <Badge variant="gray">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">
                    Created {formatLongDate(p.created_at)}
                  </p>
                </button>
              );
            })}
          </div>
        ),
    },
    {
      key: 'basic',
      name: 'Basic Details',
      description: 'Name, contact and work preference',
      tint: 'tint-purple',
      iconPath: ICON.basic,
      complete: !!user.full_name && (basic?.employment_type?.length ?? 0) > 0,
      onEdit: () => setEditTarget('basic'),
      content: <FieldGrid rows={basicDetails} />,
    },
    {
      key: 'language',
      name: 'Language',
      description: 'Languages this talent speaks',
      tint: 'tint-blue',
      iconPath: ICON.language,
      complete: (user.languages_spoken?.length ?? 0) > 0,
      onEdit: () => setEditTarget('language'),
      content: <FieldGrid rows={[{ label: 'Languages Spoken', value: formatLanguages(user.languages_spoken) }]} />,
    },
    {
      key: 'address',
      name: 'Address',
      description: 'Official and current locations',
      tint: 'tint-orange',
      iconPath: ICON.address,
      complete: !!(basic?.permanent_address || basic?.permanent_city || basic?.permanent_state),
      onEdit: () => setEditTarget('address'),
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 font-jakarta text-base font-semibold text-[#0a0a0a]">Official Address</h3>
            <FieldGrid rows={officialAddressRows} />
          </div>
          <div className="border-t border-[#E7E7EA] pt-5">
            <h3 className="mb-3 font-jakarta text-base font-semibold text-[#0a0a0a]">Current Address</h3>
            <FieldGrid rows={currentAddressRows} />
          </div>
        </div>
      ),
    },
    {
      key: 'education',
      name: 'Education & Courses',
      description: 'Educational background and courses',
      tint: 'tint-blue',
      iconPath: ICON.education,
      complete: (basic?.education_courses?.length ?? 0) > 0,
      onEdit: () => setEditTarget('education'),
      content: <FieldGrid rows={[{ label: 'Courses', value: formatEducation(basic?.education_courses) }]} />,
    },
    {
      key: 'experience',
      name: 'Experience',
      description: 'Work history and previous roles',
      tint: 'tint-pink',
      iconPath: ICON.experience,
      complete: (basic?.experience?.length ?? 0) > 0,
      onEdit: () => setEditTarget('experience'),
      content: <FieldGrid rows={[{ label: 'Experience', value: formatExperience(basic?.experience) }]} />,
    },
    {
      key: 'jobPref',
      name: 'Job Preference',
      description: 'Salary expectations and job type',
      tint: 'tint-green',
      iconPath: ICON.jobPref,
      disabled: !wantsSalary,
      trailing: selectedBadge(wantsSalary),
      complete:
        wantsSalary &&
        !!(
          basic?.availability?.length ||
          basic?.job_type?.length ||
          basic?.expected_salary_full_time ||
          basic?.expected_salary_part_time
        ),
      onEdit: () => setEditTarget('jobPref'),
      content: <FieldGrid rows={jobPrefs} />,
    },
    {
      key: 'freelance',
      name: 'Freelance Preference',
      description: 'Availability for freelance projects',
      tint: 'tint-pink',
      iconPath: ICON.freelance,
      disabled: !wantsFreelance,
      trailing: selectedBadge(wantsFreelance),
      complete: wantsFreelance && !!basic?.freelance_available,
      onEdit: () => setEditTarget('freelance'),
      content: (
        <FieldGrid
          rows={[
            {
              label: 'Available for Freelance Work',
              value: (
                <Badge variant={basic?.freelance_available ? 'green' : 'gray'}>
                  {basic?.freelance_available ? 'Available' : 'Not available'}
                </Badge>
              ),
            },
          ]}
        />
      ),
    },
    {
      key: 'partner',
      name: 'Partner Program Preference',
      description: 'Virtual office hours and daily availability',
      tint: 'tint-green',
      iconPath: ICON.partner,
      disabled: !wantsPartner,
      trailing: selectedBadge(wantsPartner),
      complete:
        wantsPartner &&
        (basic?.virtual_office_hours?.some((h) => h.from && h.to) ?? false) &&
        (basic?.daily_available_hours?.some((d) => d.hours > 0) ?? false),
      onEdit: () => setEditTarget('partner'),
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="mb-3 font-jakarta text-base font-semibold text-[#0a0a0a]">Virtual Office Hours</h3>
            <FieldGrid rows={[{ label: 'Office Hours', value: formatVirtualHours(basic?.virtual_office_hours) }]} />
          </div>
          <div className="border-t border-[#E7E7EA] pt-5">
            <h3 className="mb-3 font-jakarta text-base font-semibold text-[#0a0a0a]">Daily Available Hours</h3>
            <FieldGrid rows={[{ label: 'Committed Hours', value: formatDailyHours(basic?.daily_available_hours) }]} />
          </div>
        </div>
      ),
    },
    {
      key: 'profilePic',
      name: 'Profile Picture',
      description: 'A clear photo for the profile',
      tint: 'tint-purple',
      iconPath: ICON.profilePic,
      complete: !!photoUrl,
      onEdit: () => setEditTarget('profilePic'),
      content: photoUrl ? (
        <div className="flex items-center gap-4">
          <img src={photoUrl} alt="Profile" className="h-24 w-24 rounded-xl object-cover ring-1 ring-gray-200" />
          <a href={photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline">
            View original
          </a>
        </div>
      ) : (
        <div className="text-sm">{PLACEHOLDER}</div>
      ),
    },
    {
      key: 'idProof',
      name: 'ID Proofs',
      description: 'Aadhaar and PAN card details',
      tint: 'tint-amber',
      iconPath: ICON.idProof,
      complete: !!(basic?.aadhaar_number || basic?.pan_number),
      onEdit: () => setEditTarget('idProof'),
      content: <FieldGrid rows={idProofs} />,
    },
    {
      key: 'bank',
      name: 'Bank Account',
      description: 'Where we send payments',
      tint: 'tint-blue',
      iconPath: ICON.bank,
      complete: !!(basic?.bank_account_number || basic?.bank_name),
      onEdit: () => setEditTarget('bank'),
      content: <FieldGrid rows={bankAccount} />,
    },
    {
      key: 'resume',
      name: 'Resume',
      description: 'Resume in PDF format',
      tint: 'tint-orange',
      iconPath: ICON.resume,
      complete: !!basic?.resume_url,
      onEdit: () => setEditTarget('resume'),
      content: <FieldGrid rows={[{ label: 'Resume', value: <FileLink url={basic?.resume_url ?? null} label="View resume" /> }]} />,
    },
    {
      key: 'account',
      name: 'Account Status',
      description: 'Approval, visibility and join metadata',
      tint: 'tint-blue',
      iconPath: ICON.account,
      admin: true,
      content: <FieldGrid rows={accountStatus} />,
    },
    {
      key: 'onboarding',
      name: 'Onboarding Course',
      description: 'Bypass the onboarding gate for this talent',
      tint: 'tint-amber',
      iconPath: ICON.onboarding,
      admin: true,
      content: (
        <OnboardingBypassBody
          user={user}
          isPending={setOnboardingBypass.isPending}
          onToggle={(enabled, reason) =>
            setOnboardingBypass.mutate({ userId: user.id, skipOnboarding: enabled, reason })
          }
        />
      ),
    },
    ...(enrollments.length > 0
      ? [
          {
            key: 'enrollments',
            name: `Course Enrollments (${enrollments.length})`,
            description: 'Training courses this talent has started',
            tint: 'tint-green',
            iconPath: ICON.enrollments,
            admin: true,
            content: (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Course</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Started</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Deadline</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {enrollments.map((e) => (
                      <tr key={e.course_id}>
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{e.course_title}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatLongDate(e.started_at)}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{e.expires_at ? formatLongDate(e.expires_at) : '-'}</td>
                        <td className="px-4 py-4">
                          <Badge variant={e.expired ? 'red' : 'green'}>{e.expired ? 'Expired' : 'Active'}</Badge>
                        </td>
                        <td className="px-4 py-4">
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
            ),
          } as WizardSection,
        ]
      : []),
  ];

  // Number the talent-profile (non-admin) sections.
  let pno = 0;
  sections.forEach((s) => {
    if (!s.admin) s.no = ++pno;
  });

  const profileSections = sections.filter((s) => !s.admin);
  const enabledSections = profileSections.filter((s) => !s.disabled).length;
  const completedCount = profileSections.filter((s) => !s.disabled && s.complete).length;
  const progressPct = enabledSections > 0 ? Math.round((completedCount / enabledSections) * 100) : 0;

  const safeActive = Math.min(activeSection, sections.length - 1);
  const current = sections[safeActive];

  const goToSection = (delta: 1 | -1) => {
    let i = safeActive + delta;
    while (i >= 0 && i < sections.length && sections[i].disabled) i += delta;
    if (i >= 0 && i < sections.length) setActiveSection(i);
  };

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={user.full_name}
                className="h-20 w-20 flex-shrink-0 rounded-full object-cover ring-2 ring-gray-200"
              />
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl font-semibold text-gray-400 ring-2 ring-gray-200">
                {user.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <button
                onClick={() => router.push('/users')}
                className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
              >
                &larr; Back to Users
              </button>
              <h1 className="font-jakarta text-2xl font-bold tracking-[-0.02em] text-[#0a0a0a]">
                {user.full_name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {user.approval_status && (
                  <Badge variant={statusVariant[user.approval_status] ?? 'gray'}>
                    {TITLE_CASE(user.approval_status)}
                  </Badge>
                )}
                {!user.is_active && <Badge variant="gray">Inactive</Badge>}
                {user.suspended && <Badge variant="red">Suspended</Badge>}
                {user.blacklisted && <Badge variant="red">Blacklisted</Badge>}
              </div>
              <div className="mt-3">
                <span className="eyebrow-rainbow">
                  {completedCount} of {enabledSections} sections complete
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
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
              {leadId && (
                <Link
                  href={`/leads/${leadId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  View Candidate
                </Link>
              )}
              <button
                type="button"
                onClick={() => setActivityOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Activity
              </button>
              <DropdownMenu
                ariaLabel="More actions"
                items={[
                  {
                    label: user.is_active ? 'Mark Inactive' : 'Mark Active',
                    onClick: () => setUserActive.mutate({ userId: user.id, isActive: !user.is_active }),
                    loading: setUserActive.isPending,
                  },
                  {
                    label: user.suspended ? 'Unsuspend' : 'Suspend',
                    onClick: () => suspendUser.mutate({ userId: user.id, suspend: !user.suspended }),
                    loading: suspendUser.isPending,
                  },
                  {
                    label: user.blacklisted ? 'Unblacklist' : 'Blacklist',
                    onClick: () =>
                      blacklistUser.mutate({ userId: user.id, blacklist: !user.blacklisted }),
                    loading: blacklistUser.isPending,
                  },
                  {
                    label: 'Delete',
                    variant: 'danger',
                    onClick: handleDelete,
                    loading: deleteUser.isPending,
                  },
                ] satisfies DropdownMenuItem[]}
              />
            </div>
            <ProgressRing pct={progressPct} />
          </div>
        </div>
      </section>

      {/* ── Layout: Sidebar Stepper + Section ── */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
              Sections
            </h3>
            <nav className="flex flex-col gap-0.5">
              {sections.map((section, i) => {
                const isActive = i === safeActive;
                const isComplete = !!section.complete;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => !section.disabled && setActiveSection(i)}
                    disabled={section.disabled}
                    title={section.disabled ? 'Talent has not selected the matching work preference' : undefined}
                    className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${
                      section.disabled
                        ? 'cursor-not-allowed opacity-40'
                        : isActive
                          ? 'bg-[#F5F5F6] shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]'
                          : 'hover:bg-[#F5F5F6]'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isComplete
                          ? 'bg-emerald-50 text-emerald-600'
                          : isActive
                            ? section.tint
                            : 'bg-[#f0f0f0] text-[#a3a3a3] group-hover:bg-[#E7E7EA]'
                      }`}
                      style={isActive && !isComplete ? { color: 'var(--tint-icon)' } : undefined}
                    >
                      {isComplete ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : section.admin ? (
                        svgIcon(section.iconPath, 'h-4 w-4')
                      ) : (
                        <span className="text-xs font-semibold">{section.no}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`flex items-center gap-1.5 text-[13px] font-semibold truncate ${isActive ? 'text-[#0a0a0a]' : 'text-[#525252]'}`}>
                        <span className="truncate">{section.name}</span>
                        {section.admin && (
                          <span className="flex-shrink-0 rounded bg-[#FFFAC2] px-1 text-[9px] font-bold uppercase tracking-wide text-[#0a0a0a]">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#a3a3a3] truncate">
                        {section.disabled
                          ? 'Locked'
                          : section.admin
                            ? 'Admin'
                            : isComplete
                              ? 'Complete'
                              : 'Not started'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Active section */}
        <div className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
            <WizardSectionHeader section={current} />
            {current.content}
          </div>

          {/* Action bar */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-[#E7E7EA] bg-white/95 p-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] backdrop-blur-md">
            <button
              type="button"
              disabled={safeActive === 0}
              onClick={() => goToSection(-1)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#f0f0f0] disabled:pointer-events-none disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <span className="text-xs font-medium text-[#a3a3a3]">
              {safeActive + 1} / {sections.length}
            </span>
            <button
              type="button"
              disabled={safeActive === sections.length - 1}
              onClick={() => goToSection(1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0a0a0a]/85 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Activity timeline ── */}
      {activityOpen && (
        <CandidateActivityPanel
          talentUserId={user.id}
          title={user.full_name}
          onClose={() => setActivityOpen(false)}
        />
      )}

      {/* ── Edit dialogs ── */}
      <EditBasicDetailsDialog
        open={editTarget === 'basic'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        email={(user as TalentUser & { email?: string | null }).email ?? null}
        fullName={user.full_name}
        phone={user.phone ?? null}
        employmentType={(basic?.employment_type ?? []) as ('salary' | 'freelance' | 'partner_program')[]}
      />
      <EditLanguagesDialog
        open={editTarget === 'language'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        languages={user.languages_spoken}
      />
      <EditAddressDialog
        open={editTarget === 'address'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        initial={{
          permanent: {
            address: basic?.permanent_address ?? '',
            country: basic?.permanent_country ?? '',
            state: basic?.permanent_state ?? '',
            district: basic?.permanent_district ?? '',
            city: basic?.permanent_city ?? '',
            pin_code: basic?.permanent_pin_code ?? '',
          },
          current: {
            address: basic?.current_address ?? '',
            country: basic?.country ?? '',
            state: basic?.state ?? '',
            district: basic?.current_district ?? '',
            city: basic?.city ?? '',
            pin_code: basic?.pin_code ?? '',
          },
        }}
      />
      <EditJobPreferenceDialog
        open={editTarget === 'jobPref'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        initial={{
          availability: basic?.availability ?? [],
          job_type: basic?.job_type ?? [],
          expected_salary_full_time: basic?.expected_salary_full_time ?? null,
          expected_salary_part_time: basic?.expected_salary_part_time ?? null,
        }}
      />
      <EditEducationDialog
        open={editTarget === 'education'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        courses={basic?.education_courses ?? null}
      />
      <EditExperienceDialog
        open={editTarget === 'experience'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        entries={basic?.experience ?? null}
      />
      <EditFreelanceDialog
        open={editTarget === 'freelance'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        available={basic?.freelance_available ?? false}
      />
      <EditPartnerProgramDialog
        open={editTarget === 'partner'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        officeHours={basic?.virtual_office_hours ?? null}
        dailyAvailable={basic?.daily_available_hours ?? null}
      />
      <EditIdProofsDialog
        open={editTarget === 'idProof'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        initial={{
          aadhaar_number: basic?.aadhaar_number ?? null,
          aadhaar_file_url: basic?.aadhaar_file_url ?? null,
          pan_number: basic?.pan_number ?? null,
          pan_file_url: basic?.pan_file_url ?? null,
        }}
      />
      <EditProfilePictureDialog
        open={editTarget === 'profilePic'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        url={photoUrl}
      />
      <EditBankAccountDialog
        open={editTarget === 'bank'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        initial={{
          bank_account_holder: basic?.bank_account_holder ?? null,
          bank_name: basic?.bank_name ?? null,
          bank_account_number: basic?.bank_account_number ?? null,
          bank_ifsc_code: basic?.bank_ifsc_code ?? null,
          bank_branch_name: basic?.bank_branch_name ?? null,
        }}
      />
      <EditResumeDialog
        open={editTarget === 'resume'}
        onClose={() => setEditTarget(null)}
        userId={user.id}
        url={basic?.resume_url ?? null}
      />
    </div>
  );
}
