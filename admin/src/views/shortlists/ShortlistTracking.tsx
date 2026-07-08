'use client';

import { useState, useMemo } from 'react';
import { useShortlistTracking, type ShortlistEntry } from '@/hooks/useShortlists';
import { useCategories } from '@/hooks/useCategories';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';
import { formatDate } from '@/lib/formatDate';

export default function ShortlistTracking() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: categories } = useCategories();
  const { data: shortlists, isLoading } = useShortlistTracking(
    categoryFilter || undefined
  );

  const grouped = useMemo(() => {
    if (!shortlists) return new Map<string, ShortlistEntry[]>();
    const map = new Map<string, ShortlistEntry[]>();
    for (const entry of shortlists) {
      const list = map.get(entry.business_user_id) ?? [];
      list.push(entry);
      map.set(entry.business_user_id, list);
    }
    return map;
  }, [shortlists]);

  const totalBusinessUsers = grouped.size;
  const totalShortlisted = shortlists?.length ?? 0;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shortlist Tracking</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track talents shortlisted by business users across categories.
        </p>
      </div>

      {/* Filter + Stats */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <div className="flex gap-4 text-sm text-gray-600">
          <span>
            <strong className="text-gray-900">{totalBusinessUsers}</strong> business{totalBusinessUsers !== 1 ? ' users' : ' user'}
          </span>
          <span>
            <strong className="text-gray-900">{totalShortlisted}</strong> shortlisted talent{totalShortlisted !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : !shortlists?.length ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No shortlisted talents found.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3 text-right">Shortlisted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Array.from(grouped.entries()).map(([businessId, entries]) => {
                const first = entries[0];
                const isOpen = expanded.has(businessId);

                return (
                  <GroupRow
                    key={businessId}
                    businessId={businessId}
                    companyName={first.company_name}
                    contactPerson={first.contact_person_name}
                    contactEmail={first.contact_email}
                    count={entries.length}
                    isOpen={isOpen}
                    onToggle={() => toggleExpand(businessId)}
                    entries={entries}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Interest — Coming Soon */}
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 opacity-60">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Send Interest</h3>
              <Badge variant="yellow">Coming Soon</Badge>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">
              Track interest requests sent by business users to talents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Expandable group row ─────────────────────────────── */

function GroupRow({
  businessId,
  companyName,
  contactPerson,
  contactEmail,
  count,
  isOpen,
  onToggle,
  entries,
}: {
  businessId: string;
  companyName: string;
  contactPerson: string;
  contactEmail: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  entries: ShortlistEntry[];
}) {
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <td className="px-4 py-4 text-gray-400">
          <svg
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-6 py-4 font-medium text-gray-900">{companyName}</td>
        <td className="px-6 py-4 text-gray-500">{contactPerson}</td>
        <td className="px-6 py-4 text-gray-500">{contactEmail}</td>
        <td className="px-6 py-4 text-right">
          <Badge variant="indigo">{count}</Badge>
        </td>
      </tr>

      {isOpen && (
        <tr>
          <td colSpan={5} className="bg-gray-50 px-10 py-3">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-400">
                <tr>
                  <th className="pb-2 text-left">Talent</th>
                  <th className="pb-2 text-left">Category</th>
                  <th className="pb-2 text-right">Shortlisted On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{entry.talent_name}</span>
                        <TierBadge tier={entry.tier} tierCustom={entry.tier_custom} />
                      </div>
                    </td>
                    <td className="py-2">
                      <Badge variant="blue">{entry.category_name}</Badge>
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {formatDate(entry.shortlisted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
