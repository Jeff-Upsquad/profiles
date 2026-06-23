import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';

interface Install {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  version_name: string;
  version_code: number;
  platform: 'android' | 'ios';
  first_seen_at: string;
  last_seen_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TalentAppInstalls() {
  const [search, setSearch] = useState('');

  const { data: installs, isLoading } = useQuery<Install[]>({
    queryKey: ['admin-talent-app-installs'],
    queryFn: async () => {
      const { data } = await api.get('/admin/talent-app/installs');
      return data.installs ?? data;
    },
  });

  const rows = installs ?? [];
  const total = rows.length;
  const latestCode = rows.reduce((max, r) => Math.max(max, r.version_code), 0);
  const latestName = rows.find((r) => r.version_code === latestCode)?.version_name ?? '—';
  const onLatest = rows.filter((r) => r.version_code === latestCode).length;
  const latestPct = total ? Math.round((onLatest / total) * 100) : 0;
  const active7 = rows.filter((r) => Date.now() - new Date(r.last_seen_at).getTime() < 7 * DAY_MS).length;

  // Current version distribution (how many users sit on each build right now).
  const distMap = new Map<number, { version_name: string; version_code: number; count: number }>();
  for (const r of rows) {
    const entry = distMap.get(r.version_code) ?? {
      version_name: r.version_name,
      version_code: r.version_code,
      count: 0,
    };
    entry.count += 1;
    distMap.set(r.version_code, entry);
  }
  const distribution = Array.from(distMap.values()).sort((a, b) => b.version_code - a.version_code);

  const filtered = rows.filter(
    (r) =>
      !search ||
      r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.phone?.includes(search) ||
      r.version_name.includes(search),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Talent App</h1>
        <p className="mt-1 text-sm text-gray-500">
          Who has the talent mobile app installed and which version they&apos;re running
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Installs" value={total} />
        <StatCard label="Active (7d)" value={active7} />
        <StatCard label="Latest version" value={latestName} />
        <StatCard label="On latest" value={`${latestPct}%`} hint={`${onLatest} of ${total}`} />
      </div>

      {/* Version distribution */}
      {distribution.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Version distribution</h2>
          <div className="mt-4 space-y-3">
            {distribution.map((d) => {
              const pct = total ? Math.round((d.count / total) * 100) : 0;
              const isLatest = d.version_code === latestCode;
              return (
                <div key={d.version_code} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-sm font-medium text-gray-700">
                    {d.version_name}
                    <span className="ml-1 text-xs text-gray-400">({d.version_code})</span>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${isLatest ? 'bg-green-500' : 'bg-indigo-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-20 shrink-0 text-right text-sm text-gray-600">
                    {d.count} · {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex justify-end">
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search name, phone, version..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Installs table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {total === 0
              ? 'No app installs recorded yet. Users appear here after they open an app build that reports its version.'
              : 'No matches found'}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Version</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">First seen</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <tr key={r.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.platform === 'ios' ? 'blue' : 'green'}>{r.platform}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <span>
                        {r.version_name}
                        <span className="ml-1 text-xs text-gray-400">({r.version_code})</span>
                      </span>
                      {r.version_code === latestCode && total > 0 && (
                        <Badge variant="green">latest</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(r.first_seen_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{timeAgo(r.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}
