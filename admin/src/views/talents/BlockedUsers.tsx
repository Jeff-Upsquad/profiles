'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';
import DropdownMenu from '@/components/ui/DropdownMenu';
import { useUserActions } from '@/views/users/useUserActions';
import { formatDate } from '@/lib/formatDate';

interface BlockedProfile {
  id: string;
  status: string;
  is_active: boolean;
  created_at: string;
  category_id: string;
  talent_user_id: string;
  talent_users?: {
    full_name: string;
    profile_photo_url?: string;
    current_location?: string;
    is_active?: boolean;
    suspended?: boolean;
    blacklisted?: boolean;
    suspended_reason?: string | null;
    blacklisted_reason?: string | null;
  };
  categories?: { name: string };
  tier: 'junior' | 'pro' | 'Top Talents' | 'custom' | null;
  tier_custom: string | null;
  basic_state?: string | null;
  employment_type?: unknown;
}

type BlockTab = 'all' | 'suspended' | 'blacklisted';
type EmploymentFilter = '' | 'partner_program' | 'salary';

function employmentLabels(value: unknown): string[] {
  const types = new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
  const labels: string[] = [];
  if (types.has('partner_program') || types.has('freelance')) labels.push('Partner Program');
  if (types.has('salary')) labels.push('Jobs');
  return labels.length > 0 ? labels : ['—'];
}

export default function BlockedUsers() {
  const queryClient = useQueryClient();
  const [blockTab, setBlockTab] = useState<BlockTab>('all');
  const [employmentFilter, setEmploymentFilter] = useState<EmploymentFilter>('');
  const [search, setSearch] = useState('');
  const { suspendUser, blacklistUser, setUserActive } = useUserActions();

  const { data: profiles, isLoading } = useQuery<BlockedProfile[]>({
    queryKey: ['blocked-profiles', blockTab, employmentFilter, search],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (employmentFilter) qs.set('employment_type', employmentFilter);
      if (blockTab !== 'all') qs.set('block', blockTab);
      const params = qs.toString() ? `?${qs.toString()}` : '';
      const { data } = await api.get(`/admin/talents/blocked-profiles${params}`);
      return data.profiles ?? data;
    },
  });

  const counts = useMemo(() => {
    const list = profiles ?? [];
    return {
      total: list.length,
      suspended: list.filter((p) => p.talent_users?.suspended === true).length,
      blacklisted: list.filter((p) => p.talent_users?.blacklisted === true).length,
    };
  }, [profiles]);

  const restoreUser = useMutation({
    mutationFn: async (p: BlockedProfile) => {
      const userId = p.talent_user_id;
      if (p.talent_users?.suspended) {
        await api.patch(`/admin/users/${userId}/suspend`, { suspend: false });
      }
      if (p.talent_users?.blacklisted) {
        await api.patch(`/admin/users/${userId}/blacklist`, { blacklist: false });
      }
      await api.patch(`/admin/users/talent/${userId}/active`, { is_active: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['talent-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['talent-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-talent'] });
      toast.success('User restored — back in Partner Program / Jobs lists');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to restore user');
    },
  });

  const handleRestore = (p: BlockedProfile) => {
    const name = p.talent_users?.full_name ?? 'this user';
    if (
      confirm(
        `Restore ${name}? This clears suspended + blacklisted flags and marks the talent active so their profiles return to Partner Program / Jobs.`,
      )
    ) {
      restoreUser.mutate(p);
    }
  };

  const tabs: { key: BlockTab; label: string; count: number }[] = [
    { key: 'all', label: 'All Blocked', count: counts.total },
    { key: 'suspended', label: 'Suspended', count: counts.suspended },
    { key: 'blacklisted', label: 'Blacklisted', count: counts.blacklisted },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Blocked Users</h1>
        <p className="mt-1 text-sm text-gray-500">
          Suspended &amp; blacklisted talents across Partner Program and Jobs. Partner Program / Jobs lists show only active + inactive users.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total blocked', value: counts.total },
            { label: 'Suspended', value: counts.suspended },
            { label: 'Blacklisted', value: counts.blacklisted },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setBlockTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                blockTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t.label}
              <span className="rounded-full bg-gray-200/60 px-1.5 py-0.5 text-[10px] text-gray-500">{t.count}</span>
            </button>
          ))}
        </div>

        <select
          value={employmentFilter}
          onChange={(e) => setEmploymentFilter(e.target.value as EmploymentFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Partner + Jobs</option>
          <option value="partner_program">Partner Program</option>
          <option value="salary">Jobs</option>
        </select>

        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No blocked users</p>
          <p className="mt-1 text-sm">Suspended and blacklisted talents will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category / Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Block status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(profiles ?? []).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.talent_users?.profile_photo_url ? (
                        <img src={p.talent_users.profile_photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-600">
                          {p.talent_users?.full_name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{p.talent_users?.full_name ?? 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{p.talent_users?.current_location || p.basic_state || '-'}</div>
                      </div>
                      <TierBadge tier={p.tier} tierCustom={p.tier_custom} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{p.categories?.name ?? '-'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {employmentLabels(p.employment_type).map((l) => (
                        <Badge key={l} variant={l === 'Jobs' ? 'blue' : 'indigo'}>
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {p.talent_users?.suspended && <Badge variant="red">Suspended</Badge>}
                      {p.talent_users?.blacklisted && <Badge variant="red">Blacklisted</Badge>}
                      {!p.is_active && <Badge variant="gray">Inactive</Badge>}
                    </div>
                    {(p.talent_users?.suspended_reason || p.talent_users?.blacklisted_reason) && (
                      <p className="mt-1 max-w-56 truncate text-xs text-gray-500">
                        {p.talent_users.suspended_reason || p.talent_users.blacklisted_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={restoreUser.isPending && restoreUser.variables?.talent_user_id === p.talent_user_id}
                        onClick={() => handleRestore(p)}
                      >
                        Restore
                      </Button>
                      <DropdownMenu
                        items={[
                          ...(p.talent_users?.suspended
                            ? [
                                {
                                  label: 'Unsuspend',
                                  loading: suspendUser.isPending && suspendUser.variables?.userId === p.talent_user_id,
                                  onClick: () => suspendUser.mutate({ userId: p.talent_user_id, suspend: false }),
                                },
                              ]
                            : [
                                {
                                  label: 'Suspend',
                                  loading: suspendUser.isPending && suspendUser.variables?.userId === p.talent_user_id,
                                  onClick: () => suspendUser.mutate({ userId: p.talent_user_id, suspend: true }),
                                },
                              ]),
                          ...(p.talent_users?.blacklisted
                            ? [
                                {
                                  label: 'Unblacklist',
                                  loading: blacklistUser.isPending && blacklistUser.variables?.userId === p.talent_user_id,
                                  onClick: () => blacklistUser.mutate({ userId: p.talent_user_id, blacklist: false }),
                                },
                              ]
                            : [
                                {
                                  label: 'Blacklist',
                                  loading: blacklistUser.isPending && blacklistUser.variables?.userId === p.talent_user_id,
                                  onClick: () => blacklistUser.mutate({ userId: p.talent_user_id, blacklist: true }),
                                },
                              ]),
                          {
                            label: p.is_active ? 'Mark Inactive' : 'Mark Active',
                            loading: setUserActive.isPending && setUserActive.variables?.userId === p.talent_user_id,
                            onClick: () => setUserActive.mutate({ userId: p.talent_user_id, isActive: !p.is_active }),
                          },
                          {
                            label: 'View Profile',
                            onClick: () => window.open(`/talents/${p.category_id}/${p.id}?type=partner_program`, '_blank'),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Tip: <Link href="/users" className="text-indigo-600 hover:underline">User Management</Link> still supports per-user Suspend / Blacklist. Restored users reappear in Partner Program / Jobs automatically.
      </p>
    </div>
  );
}
