import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';
import DropdownMenu from '@/components/ui/DropdownMenu';
import Modal from '@/components/ui/Modal';
import { resolveLocation, COUNTRIES, UNKNOWN_STATE, type Country } from '@/lib/location';

interface TalentProfile {
  id: string;
  status: string;
  is_active: boolean;
  created_at: string;
  talent_users?: {
    full_name: string;
    profile_photo_url?: string;
    current_location?: string;
    is_active?: boolean;
  };
  categories?: { name: string };
  tier: 'junior' | 'pro' | 'elite' | 'custom' | null;
  tier_custom: string | null;
}

type TierKey = 'elite' | 'pro' | 'junior' | 'custom' | 'none';

const statusVariant: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green',
  pending_review: 'yellow',
  rejected: 'red',
  draft: 'gray',
  inactive: 'gray',
};

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'draft', label: 'Draft' },
  { key: 'inactive', label: 'Inactive' },
];

const TIER_OPTIONS: { key: TierKey | ''; label: string }[] = [
  { key: '', label: 'All Tiers' },
  { key: 'elite', label: 'Elite' },
  { key: 'pro', label: 'Pro' },
  { key: 'junior', label: 'Junior' },
  { key: 'custom', label: 'Custom' },
  { key: 'none', label: 'No Tier' },
];

const TIER_CARDS: { key: TierKey; label: string; tier: 'elite' | 'pro' | 'junior' | null; borderColor: string }[] = [
  { key: 'elite', label: 'Elite', tier: 'elite', borderColor: 'border-indigo-300' },
  { key: 'pro', label: 'Pro', tier: 'pro', borderColor: 'border-green-300' },
  { key: 'junior', label: 'Junior', tier: 'junior', borderColor: 'border-gray-300' },
  { key: 'none', label: 'No Tier', tier: null, borderColor: 'border-gray-200' },
];

function tierKeyOf(profile: TalentProfile): TierKey {
  if (!profile.tier) return 'none';
  if (profile.tier === 'elite' || profile.tier === 'pro' || profile.tier === 'junior' || profile.tier === 'custom') return profile.tier;
  return 'none';
}

export default function TalentProfileList({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<TierKey | ''>('');
  const [countryFilter, setCountryFilter] = useState<Country | ''>('');
  const [stateFilter, setStateFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showGeography, setShowGeography] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingProfileId, setRejectingProfileId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { data: profiles, isLoading } = useQuery<TalentProfile[]>({
    queryKey: ['talent-profiles', categoryId, search],
    queryFn: async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const { data } = await api.get(`/admin/talents/categories/${categoryId}/profiles${params}`);
      return data.profiles ?? data;
    },
  });

  // --- Computed stats ---

  // Resolve location for each profile once. Memoized so we don't re-parse
  // on every render. Returns a parallel array aligned with `profiles`.
  const profileLocations = useMemo(() => {
    return (profiles ?? []).map((p) => resolveLocation(p.talent_users?.current_location));
  }, [profiles]);

  const { tierCounts, statusCounts, matrix, countryCounts, stateCounts } = useMemo(() => {
    const tc: Record<TierKey, number> = { elite: 0, pro: 0, junior: 0, custom: 0, none: 0 };
    const sc: Record<string, number> = {};
    const mx: Record<string, Record<TierKey, number>> = {};
    const cc: Record<string, number> = {};
    const stc: Record<string, number> = {};

    (profiles ?? []).forEach((p, i) => {
      const tk = tierKeyOf(p);
      tc[tk]++;
      sc[p.status] = (sc[p.status] ?? 0) + 1;
      if (!mx[p.status]) mx[p.status] = { elite: 0, pro: 0, junior: 0, custom: 0, none: 0 };
      mx[p.status][tk]++;

      const loc = profileLocations[i];
      const countryKey = loc.country ?? 'Unknown';
      cc[countryKey] = (cc[countryKey] ?? 0) + 1;
      stc[loc.state] = (stc[loc.state] ?? 0) + 1;
    });

    return { tierCounts: tc, statusCounts: sc, matrix: mx, countryCounts: cc, stateCounts: stc };
  }, [profiles, profileLocations]);

  // States to show in the dropdown — only those with at least one profile,
  // plus an "Unknown" bucket if any profile didn't match a state.
  const availableStates = useMemo(() => {
    const entries = Object.entries(stateCounts).sort((a, b) => {
      if (a[0] === UNKNOWN_STATE) return 1;
      if (b[0] === UNKNOWN_STATE) return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    });
    return entries;
  }, [stateCounts]);

  const filteredProfiles = useMemo(() => {
    let list = profiles ?? [];
    let locs = profileLocations;
    if (statusFilter) {
      const idx = list.map((p, i) => [p, locs[i]] as const).filter(([p]) => p.status === statusFilter);
      list = idx.map(([p]) => p);
      locs = idx.map(([, l]) => l);
    }
    if (tierFilter) {
      const idx = list.map((p, i) => [p, locs[i]] as const).filter(([p]) => tierKeyOf(p) === tierFilter);
      list = idx.map(([p]) => p);
      locs = idx.map(([, l]) => l);
    }
    if (countryFilter) {
      const idx = list.map((p, i) => [p, locs[i]] as const).filter(([, l]) => l.country === countryFilter);
      list = idx.map(([p]) => p);
      locs = idx.map(([, l]) => l);
    }
    if (stateFilter) {
      const idx = list.map((p, i) => [p, locs[i]] as const).filter(([, l]) => l.state === stateFilter);
      list = idx.map(([p]) => p);
      locs = idx.map(([, l]) => l);
    }
    return list;
  }, [profiles, profileLocations, statusFilter, tierFilter, countryFilter, stateFilter]);

  const pendingInView = useMemo(
    () => filteredProfiles.filter((p) => p.status === 'pending_review'),
    [filteredProfiles],
  );

  // --- Mutations ---

  const deleteProfile = useMutation({
    mutationFn: async (profileId: string) => {
      await api.delete(`/admin/talents/profiles/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-profiles', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast.success('Profile moved to recycle bin');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete profile');
    },
  });

  const approveProfile = useMutation({
    mutationFn: async (profileId: string) => {
      await api.patch(`/admin/reviews/${profileId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-profiles', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Profile approved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve profile');
    },
  });

  const rejectProfile = useMutation({
    mutationFn: async ({ profileId, reason }: { profileId: string; reason: string }) => {
      await api.patch(`/admin/reviews/${profileId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-profiles', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setRejectModalOpen(false);
      setRejectingProfileId(null);
      setRejectionReason('');
      toast.success('Profile rejected');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject profile');
    },
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.patch('/admin/reviews/bulk-approve', { profile_ids: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['talent-profiles', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setSelectedIds(new Set());
      toast.success('Profiles approved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Bulk approve failed');
    },
  });

  // --- Selection helpers ---

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPending = () => {
    if (pendingInView.length === 0) return;
    const allSelected = pendingInView.every((p) => selectedIds.has(p.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of pendingInView) next.delete(p.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of pendingInView) next.add(p.id);
        return next;
      });
    }
  };

  const categoryName = profiles?.[0]?.categories?.name ?? 'Category';
  const total = profiles?.length ?? 0;
  const hasPendingInView = pendingInView.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/talents')}
          className="mb-2 text-sm text-gray-500 hover:text-indigo-600"
        >
          &larr; Back to Categories
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{categoryName} Profiles</h1>
        <p className="mt-1 text-sm text-gray-500">
          {filteredProfiles.length === total
            ? `${total} profiles`
            : `${filteredProfiles.length} of ${total} profiles`}
        </p>
      </div>

      {/* Tier stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TIER_CARDS.map((card) => {
            const count = card.key === 'none'
              ? tierCounts.none
              : tierCounts[card.key];
            const isActive = tierFilter === card.key;
            return (
              <button
                key={card.key}
                onClick={() => setTierFilter(isActive ? '' : card.key)}
                className={`rounded-xl border bg-white p-4 text-left transition ${
                  isActive
                    ? `${card.borderColor} ring-2 ring-indigo-500 ring-offset-1`
                    : `${card.borderColor} hover:border-indigo-300`
                }`}
              >
                <div className="flex items-center gap-2">
                  {card.tier ? (
                    <TierBadge tier={card.tier} />
                  ) : (
                    <span className="text-xs font-medium text-gray-400">{card.label}</span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{count === 1 ? 'profile' : 'profiles'}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Breakdown matrix (collapsible) */}
      {!isLoading && total > 0 && (
        <div>
          <button
            onClick={() => setShowBreakdown((v) => !v)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
          </button>
          {showBreakdown && (
            <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    {(['elite', 'pro', 'junior', 'custom', 'none'] as TierKey[]).map((tk) => (
                      <th key={tk} className="px-3 py-2 text-center text-xs font-medium uppercase text-gray-500">
                        {tk === 'none' ? 'No Tier' : tk.charAt(0).toUpperCase() + tk.slice(1)}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-medium uppercase text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {STATUS_TABS.filter((t) => t.key).map((tab) => {
                    const row = matrix[tab.key];
                    const rowTotal = statusCounts[tab.key] ?? 0;
                    return (
                      <tr key={tab.key} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <Badge variant={statusVariant[tab.key] ?? 'gray'}>{tab.label}</Badge>
                        </td>
                        {(['elite', 'pro', 'junior', 'custom', 'none'] as TierKey[]).map((tk) => {
                          const val = row?.[tk] ?? 0;
                          return (
                            <td key={tk} className="px-3 py-2 text-center">
                              {val > 0 ? (
                                <button
                                  onClick={() => { setStatusFilter(tab.key); setTierFilter(tk); }}
                                  className="font-medium text-indigo-600 hover:underline"
                                >
                                  {val}
                                </button>
                              ) : (
                                <span className="text-gray-300">0</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-semibold text-gray-700">{rowTotal}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-2 text-xs uppercase text-gray-500">Total</td>
                    {(['elite', 'pro', 'junior', 'custom', 'none'] as TierKey[]).map((tk) => (
                      <td key={tk} className="px-3 py-2 text-center text-gray-700">{tierCounts[tk]}</td>
                    ))}
                    <td className="px-3 py-2 text-center text-gray-900">{total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Geography snapshot (collapsible) */}
      {!isLoading && total > 0 && (
        <div>
          <button
            onClick={() => setShowGeography((v) => !v)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showGeography ? 'Hide Geography' : 'Show Geography'}
          </button>
          {showGeography && (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {/* Countries */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase text-gray-500">
                  Countries
                </div>
                <ul className="divide-y divide-gray-100">
                  {Object.entries(countryCounts)
                    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                    .map(([country, count]) => {
                      const isKnown = country !== 'Unknown';
                      const isActive = countryFilter === country;
                      return (
                        <li key={country}>
                          <button
                            disabled={!isKnown}
                            onClick={() => {
                              if (!isKnown) return;
                              setCountryFilter(isActive ? '' : (country as Country));
                              setStateFilter('');
                            }}
                            className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${
                              isActive
                                ? 'bg-indigo-50 text-indigo-700'
                                : isKnown
                                  ? 'hover:bg-gray-50'
                                  : 'text-gray-400'
                            }`}
                          >
                            <span>{country}</span>
                            <span className="font-semibold">{count}</span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>

              {/* States */}
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase text-gray-500">
                  States
                </div>
                <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                  {availableStates.map(([state, count]) => {
                    const isActive = stateFilter === state;
                    const isUnknown = state === UNKNOWN_STATE;
                    return (
                      <li key={state}>
                        <button
                          onClick={() => setStateFilter(isActive ? '' : state)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'hover:bg-gray-50'
                          } ${isUnknown ? 'text-gray-500' : ''}`}
                        >
                          <span>{state}</span>
                          <span className="font-semibold">{count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters: status tabs + tier dropdown + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.key ? (statusCounts[tab.key] ?? 0) : total;
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  isActive ? 'bg-gray-200 text-gray-700' : 'bg-gray-200/60 text-gray-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as TierKey | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TIER_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>

        <select
          value={countryFilter}
          onChange={(e) => {
            const v = e.target.value as Country | '';
            setCountryFilter(v);
            // Clear state when country changes — different countries have different states.
            setStateFilter('');
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Countries</option>
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All States</option>
          {availableStates.map(([state, count]) => (
            <option key={state} value={state}>
              {state} ({count})
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        {(statusFilter || tierFilter || countryFilter || stateFilter) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setTierFilter('');
              setCountryFilter('');
              setStateFilter('');
              setSelectedIds(new Set());
            }}
            className="text-xs text-gray-500 hover:text-indigo-600"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk approve bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            loading={bulkApprove.isPending}
            onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
          >
            Approve Selected
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">No profiles found</p>
          {(statusFilter || tierFilter) && (
            <p className="mt-1 text-sm">Try adjusting your filters.</p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {hasPendingInView && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={pendingInView.length > 0 && pendingInView.every((p) => selectedIds.has(p.id))}
                      onChange={toggleAllPending}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProfiles.map((profile) => {
                const isPending = profile.status === 'pending_review';
                return (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    {hasPendingInView && (
                      <td className="px-4 py-3">
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(profile.id)}
                            onChange={() => toggleSelect(profile.id)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                        ) : (
                          <span />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {profile.talent_users?.profile_photo_url ? (
                          <img
                            src={profile.talent_users.profile_photo_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
                            {profile.talent_users?.full_name?.charAt(0) ?? '?'}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {profile.talent_users?.full_name ?? 'Unknown'}
                        </span>
                        <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {profile.talent_users?.current_location ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={statusVariant[profile.status] ?? 'gray'}>
                          {profile.status.replace('_', ' ')}
                        </Badge>
                        {!profile.is_active && <Badge variant="gray">Hidden</Badge>}
                        {profile.talent_users?.is_active === false && (
                          <Badge variant="gray">Talent hidden</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isPending ? (
                        <DropdownMenu
                          items={[
                            {
                              label: 'Approve',
                              onClick: () => approveProfile.mutate(profile.id),
                              loading: approveProfile.isPending && approveProfile.variables === profile.id,
                            },
                            {
                              label: 'Reject',
                              onClick: () => {
                                setRejectingProfileId(profile.id);
                                setRejectModalOpen(true);
                              },
                              variant: 'danger',
                            },
                            {
                              label: 'Review Details',
                              onClick: () => router.push(`/reviews/${profile.id}`),
                            },
                            {
                              label: 'View Profile',
                              onClick: () => router.push(`/talents/${categoryId}/${profile.id}`),
                            },
                            {
                              label: 'Delete',
                              variant: 'danger',
                              onClick: () => {
                                if (confirm('Delete this profile? It will be moved to the recycle bin and can be restored later.')) {
                                  deleteProfile.mutate(profile.id);
                                }
                              },
                              loading: deleteProfile.isPending && deleteProfile.variables === profile.id,
                            },
                          ]}
                        />
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Link href={`/talents/${categoryId}/${profile.id}`}>
                            <Button variant="ghost" size="sm">View</Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            loading={deleteProfile.isPending && deleteProfile.variables === profile.id}
                            onClick={() => {
                              if (
                                confirm(
                                  'Delete this profile? It will be moved to the recycle bin and can be restored later.'
                                )
                              ) {
                                deleteProfile.mutate(profile.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectingProfileId(null);
          setRejectionReason('');
        }}
        title="Reject Profile"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this profile. The talent will be able to see
            this reason and make corrections.
          </p>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Reason for rejection..."
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectingProfileId(null);
                setRejectionReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!rejectionReason.trim()}
              loading={rejectProfile.isPending}
              onClick={() => {
                if (rejectingProfileId && rejectionReason.trim()) {
                  rejectProfile.mutate({ profileId: rejectingProfileId, reason: rejectionReason.trim() });
                }
              }}
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
