'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { formatIndianPhone } from '@/lib/phone';
import { PIPELINE_STAGES, timeAgo } from '@/views/onboarding/hubTypes';

// ---------------------------------------------------------------------------
// Dashboard — two views, one per onboarding module: Partner Program and Jobs.
// Each view is a complete module dashboard: user counts (live / active on
// app / inactive / new), the onboarding funnel, weekly signup report and the
// latest sign-ups. Data from /admin/dashboard/activity (backend
// dashboard-activity.service.ts); the selected view lives in ?view=.
// ---------------------------------------------------------------------------

type Track = 'partner' | 'jobs';

interface ModuleStats {
  total_users: number;
  total_users_net: number;
  blocked: number;
  cancelled: number;
  live: number;
  inactive: number;
  new_7d: number;
  new_30d: number;
  active_7d: number;
  active_30d: number;
  app_installed: number;
  engaged_7d: number;
  engaged_30d: number;
  total: number;
  pending_approval: number;
  rejected: number;
  by_stage: Record<string, number>;
}

interface RecentSignup {
  id: string;
  full_name: string | null;
  phone: string | null;
  tracks: Track[];
  stage: string;
  live: boolean;
  created_at: string | null;
}

interface ActivityData {
  generated_at: string;
  modules: Record<Track, ModuleStats>;
  /** False until the platform-login RPC migration is applied — "active" then
   *  means last app/course/profile/card activity instead of exact logins. */
  login_tracking_available: boolean;
  signups_weekly: { week_start: string; partner: number; jobs: number }[];
  recent_signups: Record<Track, RecentSignup[]>;
}

const MODULE_META: Record<
  Track,
  {
    label: string;
    tabLabel: string;
    description: string;
    href: string;
    talentsHref: string;
    /** Chart + accent colours for this view. */
    accent: string;
    accentSoft: string;
    bar: string;
    text: string;
  }
> = {
  partner: {
    label: 'Partner Program',
    tabLabel: 'Partner Program',
    description: 'Users in the Partner Program onboarding module',
    href: '/approvals',
    talentsHref: '/talents?type=partner_program',
    accent: '#4f46e5',
    accentSoft: '#818cf8',
    bar: 'bg-indigo-500',
    text: 'text-indigo-600',
  },
  jobs: {
    label: 'Jobs',
    tabLabel: 'Jobs',
    description: 'Users in the Jobs onboarding module',
    href: '/jobs-onboarding',
    talentsHref: '/talents?type=salary',
    accent: '#0d9488',
    accentSoft: '#5eead4',
    bar: 'bg-teal-600',
    text: 'text-teal-600',
  },
};

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label]),
);

function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />;
}

function StatCard({
  label,
  value,
  loading,
  tone,
  sub,
  href,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  tone?: 'live' | 'active' | 'inactive' | 'new' | 'plain';
  sub?: React.ReactNode;
  href?: string;
}) {
  const toneCls =
    tone === 'live'
      ? 'text-emerald-600'
      : tone === 'active'
        ? 'text-indigo-600'
        : tone === 'inactive'
          ? 'text-gray-500'
          : tone === 'new'
            ? 'text-sky-600'
            : 'text-gray-900';
  const body = (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className={`mt-2 text-3xl font-semibold ${toneCls}`}>
          {value?.toLocaleString() ?? '--'}
        </p>
      )}
      {sub && <div className="mt-1.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/**
 * Wide "Active" card: total active users (platform logins, or app activity
 * while login tracking is unavailable) plus the mobile-app breakdown —
 * downloaded and active on mobile.
 */
function ActiveCard({
  stats,
  loading,
  loginTracking,
}: {
  stats: ModuleStats | undefined;
  loading: boolean;
  loginTracking: boolean;
}) {
  return (
    <div className="col-span-2 h-full rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-500">Active users</p>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
          30 days
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-3xl font-semibold text-indigo-600">
            {stats?.active_30d.toLocaleString() ?? '--'}
          </p>
          <p
            className="text-xs text-gray-500"
            title={
              loginTracking
                ? 'Signed in to the platform (web or app) in the last 30 days.'
                : 'Used the platform in the last 30 days — measured from app opens, course progress, profile edits and opportunity-card views. Apply migration 20261022000000 to switch to exact login times.'
            }
          >
            used the platform · 30 days
            {stats?.active_7d !== undefined && <> · {stats.active_7d} in the last 7 days</>}
          </p>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
        <div>
          <p className="text-[11px] font-medium text-gray-500">Mobile app · downloaded</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-12" />
          ) : (
            <p className="text-lg font-bold text-gray-900">{stats?.app_installed.toLocaleString()}</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-medium text-gray-500">Active on mobile · 30d</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-12" />
          ) : (
            <p className="text-lg font-bold text-gray-900">{stats?.engaged_30d.toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Dual-figure card for the two groups excluded from Total users. */
function ExcludedCard({
  stats,
  loading,
  href,
}: {
  stats: ModuleStats | undefined;
  loading: boolean;
  href: string;
}) {
  return (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300">
      <p className="text-sm font-medium text-gray-500">Cancelled &amp; blocked</p>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <div className="mt-2 flex items-baseline gap-4">
          <div>
            <p className="text-3xl font-semibold text-gray-500">
              {stats?.cancelled.toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400">cancelled</p>
          </div>
          <div className="h-8 w-px bg-gray-100" />
          <div>
            <p className="text-3xl font-semibold text-gray-500">
              {stats?.blocked.toLocaleString()}
            </p>
            <p className="text-[11px] text-gray-400">blocked</p>
          </div>
        </div>
      )}
      <Link href={href} className="mt-1.5 inline-block text-xs text-gray-400 hover:text-indigo-600">
        excluded from Total users
      </Link>
    </div>
  );
}

/** Horizontal proportion bar with a legend underneath. */
function SplitBar({ parts }: { parts: { label: string; count: number; cls: string }[] }) {
  const total = parts.reduce((n, p) => n + p.count, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {parts.map((p) =>
          p.count > 0 ? (
            <div
              key={p.label}
              className={p.cls}
              style={{ width: `${(p.count / total) * 100}%` }}
              title={`${p.label}: ${p.count}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`h-2 w-2 rounded-full ${p.cls}`} />
            {p.label} · <span className="font-semibold text-gray-900">{p.count.toLocaleString()}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact single-series bar chart (SVG, no chart lib) for the weekly signups. */
function WeeklySignupsChart({
  weeks,
  valueOf,
  accent,
  accentSoft,
  ariaLabel,
}: {
  weeks: ActivityData['signups_weekly'];
  valueOf: (w: ActivityData['signups_weekly'][number]) => number;
  accent: string;
  accentSoft: string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...weeks.map(valueOf));
  const barW = 18;
  const groupW = barW + 14;
  const chartW = Math.max(weeks.length * groupW + 40, 280);
  const chartH = 150;
  const plotH = chartH - 26;
  const h = (v: number) => Math.round((v / max) * (plotH - 10));
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div className="overflow-x-auto">
      <svg width={chartW} height={chartH} role="img" aria-label={ariaLabel}>
        {[max, Math.round(max / 2)].map((g, i) => {
          const y = plotH - h(g);
          return g > 0 ? (
            <g key={i}>
              <line x1={28} x2={chartW - 6} y1={y} y2={y} stroke="#f3f4f6" strokeWidth={1} />
              <text x={24} y={y + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{g}</text>
            </g>
          ) : null;
        })}
        {weeks.map((w, i) => {
          const v = valueOf(w);
          const barH = h(v);
          const thisWeek = i === weeks.length - 1;
          return (
            <g key={w.week_start}>
              <rect
                x={30 + i * groupW} y={plotH - barH} width={barW} height={barH} rx={3}
                fill={thisWeek ? accent : accentSoft}
              >
                <title>{`${fmt(w.week_start)}: ${v} sign-up${v === 1 ? '' : 's'}`}</title>
              </rect>
              <text x={30 + i * groupW + barW / 2} y={chartH - 8} textAnchor="middle" fontSize={9} fill="#6b7280">
                {fmt(w.week_start)}
              </text>
            </g>
          );
        })}
        <line x1={28} x2={chartW - 6} y1={plotH} y2={plotH} stroke="#e5e7eb" strokeWidth={1} />
      </svg>
    </div>
  );
}

/** One module's complete dashboard view. */
function ModuleView({
  track,
  data,
  loading,
}: {
  track: Track;
  data: ActivityData | undefined;
  loading: boolean;
}) {
  const meta = MODULE_META[track];
  const stats = data?.modules[track];
  const funnel = stats
    ? PIPELINE_STAGES.map((s) => ({ ...s, count: stats.by_stage[s.value] ?? 0 }))
    : [];

  return (
    <div className="space-y-6">
      {/* Users overview for this module */}
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {meta.description}
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total users"
            value={stats?.total_users_net}
            loading={loading}
            href={meta.talentsHref}
            sub="excludes cancelled & blocked"
          />
          <StatCard label="Live" value={stats?.live} loading={loading} tone="live" href={meta.talentsHref}
            sub="On the talent board" />
          <ActiveCard stats={stats} loading={loading} loginTracking={data?.login_tracking_available ?? false} />
          <StatCard label="Inactive" value={stats?.inactive} loading={loading} tone="inactive" href={meta.talentsHref}
            sub={`of ${stats?.total_users_net ?? 0} total`} />
          <StatCard label="New · 30 days" value={stats?.new_30d} loading={loading} tone="new"
            sub={`${stats?.new_7d ?? 0} in the last 7 days`} />
          <StatCard label="In onboarding" value={stats?.total} loading={loading} href={meta.href}
            sub={stats?.pending_approval ? `${stats.pending_approval} awaiting approval` : 'current funnel'} />
          <ExcludedCard stats={stats} loading={loading} href="/cancelled-applicants" />
        </div>
      </section>

      {/* Funnel */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Sign-up journey · candidate pipeline
          </p>
          <Link href={meta.href} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            Open module →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {funnel.map((s) => (
            <Link
              key={s.value}
              href={meta.href}
              className={`rounded-xl border p-3 text-left transition hover:bg-gray-50 ${
                s.count > 0 ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-white opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                <span className="truncate text-[11px] font-medium text-gray-600">{s.label}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-900">{s.count}</p>
            </Link>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          {stats && stats.pending_approval > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {stats.pending_approval} awaiting approval
            </span>
          )}
          {stats && stats.rejected > 0 && (
            <Link href="/rejected-candidates" className="hover:text-gray-700">{stats.rejected} rejected</Link>
          )}
          {stats && stats.cancelled > 0 && (
            <Link href="/cancelled-applicants" className="hover:text-gray-700">{stats.cancelled} cancelled</Link>
          )}
          <Link href={meta.talentsHref} className="ml-auto font-medium text-indigo-600 hover:text-indigo-700">
            View onboarded talents →
          </Link>
        </div>
      </section>

      {/* Reports */}
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Reports</p>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">New sign-ups per week</h3>
              <span className="text-xs text-gray-400">last 9 weeks</span>
            </div>
            {loading ? (
              <Skeleton className="mt-4 h-40 w-full" />
            ) : (
              <div className="mt-3">
                <WeeklySignupsChart
                  weeks={data?.signups_weekly ?? []}
                  valueOf={(w) => w[track]}
                  accent={meta.accent}
                  accentSoft={meta.accentSoft}
                  ariaLabel={`${meta.label} weekly sign-ups`}
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">{meta.label} users — live vs inactive</h3>
            {loading ? (
              <Skeleton className="mt-4 h-10 w-full" />
            ) : (
              <div className="mt-3">
                <SplitBar
                  parts={[
                    { label: 'Live', count: stats?.live ?? 0, cls: 'bg-emerald-500' },
                    { label: 'Inactive', count: stats?.inactive ?? 0, cls: 'bg-gray-300' },
                    { label: 'Blocked / suspended', count: stats?.blocked ?? 0, cls: 'bg-red-400' },
                  ]}
                />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-indigo-50 p-2.5">
                    <p className="text-lg font-bold text-indigo-700">{stats?.active_7d ?? 0}</p>
                    <p className="text-[11px] text-indigo-600">active this week</p>
                  </div>
                  <div className="rounded-lg bg-indigo-50/60 p-2.5">
                    <p className="text-lg font-bold text-indigo-700">{stats?.active_30d ?? 0}</p>
                    <p className="text-[11px] text-indigo-600">active · 30 days</p>
                  </div>
                  <div className="rounded-lg bg-sky-50 p-2.5">
                    <p className="text-lg font-bold text-sky-700">{stats?.new_7d ?? 0}</p>
                    <p className="text-[11px] text-sky-600">new this week</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Latest sign-ups in this module */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            New candidates — latest {meta.label} sign-ups
          </p>
          <Link href={meta.href} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
            View all →
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (data?.recent_signups[track].length ?? 0) === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-500">No sign-ups yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-2.5">Candidate</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Module</th>
                  <th className="px-4 py-2.5">Stage</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Signed up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.recent_signups[track].map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{s.full_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{s.phone ? formatIndianPhone(s.phone) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {s.tracks.map((t) => (
                          <span
                            key={t}
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              t === 'partner'
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                : 'border-teal-200 bg-teal-50 text-teal-700'
                            }`}
                          >
                            {t === 'partner' ? 'Partner Program' : 'Jobs'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{stageLabel(s.stage)}</td>
                    <td className="px-4 py-2.5">
                      {s.live ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Live</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700">Onboarding</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500" title={s.created_at ?? undefined}>
                      {s.created_at ? timeAgo(s.created_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const track: Track = searchParams.get('view') === 'jobs' ? 'jobs' : 'partner';

  const { data, isLoading } = useQuery<ActivityData>({
    queryKey: ['admin', 'dashboard', 'activity'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard/activity');
      return data;
    },
  });

  const meta = MODULE_META[track];
  const stats = data?.modules[track];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta.description} — live, active and inactive users.
            {data?.generated_at && (
              <span className="text-gray-400"> · updated {timeAgo(data.generated_at)}</span>
            )}
          </p>
        </div>
        <Link
          href={meta.href}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {(stats?.pending_approval ?? 0) > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1 text-[11px] font-bold text-amber-800">
              {stats?.pending_approval}
            </span>
          )}
          Open {meta.label}
        </Link>
      </div>

      {/* View switcher */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {(['partner', 'jobs'] as Track[]).map((t) => (
          <Link
            key={t}
            href={t === 'partner' ? '/' : '/?view=jobs'}
            className={`flex-1 rounded-md px-3.5 py-2 text-center text-sm font-medium transition-colors sm:flex-none ${
              track === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {MODULE_META[t].tabLabel}
            {data && (
              <span
                className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${
                  track === t ? `bg-gray-100 ${MODULE_META[t].text}` : 'bg-gray-200 text-gray-600'
                }`}
              >
                {data.modules[t].live}
              </span>
            )}
          </Link>
        ))}
      </div>

      <ModuleView track={track} data={data} loading={isLoading} />
    </div>
  );
}
