'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface AgencyRow {
  id: string;
  agency_name: string;
  agency_short_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  location?: string | null;
  approval_status: string;
  is_active: boolean;
  suspended?: boolean;
  blacklisted?: boolean;
  created_at: string;
  rejection_reason?: string | null;
}

interface Stats {
  total: number;
  by_status: Record<string, number>;
  pending: number;
  approved: number;
  rejected: number;
  active: number;
  suspended: number;
}

function StatusBadge({ status, isActive, suspended }: { status: string; isActive?: boolean; suspended?: boolean }) {
  if (suspended) return <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Suspended</span>;
  if (isActive === false) return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Inactive</span>;
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border border-red-200',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-700 border border-gray-200';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default function AgencyList() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: stats } = useQuery<Stats>({
    queryKey: ['agency-stats'],
    queryFn: async () => (await api.get('/admin/agencies/stats')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['agencies', debounced, status, page],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (debounced) params.search = debounced;
      if (status !== 'all') params.approval_status = status;
      const { data } = await api.get('/admin/agencies', { params });
      return data as { agencies: AgencyRow[]; total: number; total_pages: number; page: number };
    },
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/admin/agencies/${id}/approve`)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agencies'] }); qc.invalidateQueries({ queryKey: ['agency-stats'] }); toast.success('Approved'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Approve failed'),
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => (await api.patch(`/admin/agencies/${id}/reject`, { reason })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agencies'] }); qc.invalidateQueries({ queryKey: ['agency-stats'] }); toast.success('Rejected'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reject failed'),
  });

  const bulkApproveMut = useMutation({
    mutationFn: async (ids: string[]) => (await api.post('/admin/agencies/bulk-approve', { ids })).data,
    onSuccess: (res: any) => {
      const ok = (res.results ?? []).filter((r: any) => r.success).length;
      toast.success(`${ok} agency approved`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['agencies'] }); qc.invalidateQueries({ queryKey: ['agency-stats'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Bulk approve failed'),
  });

  const agencies = data?.agencies ?? [];
  const totalPages = data?.total_pages ?? 1;

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    const pendingIds = agencies.filter(a => a.approval_status === 'pending').map(a => a.id);
    const allSelected = pendingIds.every(id => selected.has(id)) && pendingIds.length > 0;
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); pendingIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pendingIds.forEach(id => n.add(id)); return n; });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agencies</h1>
          <p className="mt-1 text-sm text-gray-500">Review, approve and manage agency partners. Duplicate email/phone detection is automatic.</p>
        </div>
        {selected.size > 0 && (
          <button onClick={() => bulkApproveMut.mutate([...selected])} disabled={bulkApproveMut.isPending} className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            {bulkApproveMut.isPending ? 'Approving…' : `Approve ${selected.size} selected`}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Total</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{stats?.total ?? '-'}</div>
          <div className="text-xs text-gray-500">{stats?.active ?? 0} active</div>
        </div>
        <button onClick={() => { setStatus('pending'); setPage(1); }} className={`rounded-xl border p-4 text-left shadow-sm transition ${status === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
          <div className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending review</div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{stats?.pending ?? '-'}</div>
          <div className="text-xs text-amber-700/70">Needs action</div>
        </button>
        <button onClick={() => { setStatus('approved'); setPage(1); }} className={`rounded-xl border p-4 text-left shadow-sm transition ${status === 'approved' ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">Approved</div>
          <div className="mt-1 text-2xl font-bold text-emerald-800">{stats?.approved ?? '-'}</div>
          <div className="text-xs text-emerald-700/70">Live on platform</div>
        </button>
        <button onClick={() => { setStatus('rejected'); setPage(1); }} className={`rounded-xl border p-4 text-left shadow-sm transition ${status === 'rejected' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
          <div className="text-xs font-medium uppercase tracking-wider text-red-700">Rejected</div>
          <div className="mt-1 text-2xl font-bold text-red-800">{stats?.rejected ?? '-'}</div>
          <div className="text-xs text-red-700/70">Declined</div>
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Suspended</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{stats?.suspended ?? '-'}</div>
          <div className="text-xs text-gray-500">Blocked</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {(['all','pending','approved','rejected'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${status===s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>{s === 'all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search agency, email, phone…" className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" /></svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>
        ) : agencies.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100"><svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1" /></svg></div>
            <p className="mt-3 text-sm font-medium text-gray-700">No agencies found</p>
            <p className="text-sm text-gray-500">Adjust filters or invite agencies to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-3 py-3"><input type="checkbox" onChange={toggleAll} checked={agencies.filter(a=>a.approval_status==='pending').length>0 && agencies.filter(a=>a.approval_status==='pending').every(a=>selected.has(a.id))} className="rounded border-gray-300" /></th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Agency</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Email / Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {agencies.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3" onClick={e=>e.stopPropagation()}><input type="checkbox" disabled={a.approval_status !== 'pending'} checked={selected.has(a.id)} onChange={()=>toggleOne(a.id)} className="rounded border-gray-300 disabled:opacity-30" /></td>
                      <td className="cursor-pointer px-4 py-3" onClick={() => router.push(`/agencies/${a.id}`)}>
                        <div className="text-sm font-medium text-gray-900">{a.agency_name}</div>
                        {a.agency_short_name && <div className="text-xs text-gray-500">{a.agency_short_name}</div>}
                        {a.location && <div className="text-xs text-gray-400">{a.location}</div>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.contact_person || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700 truncate max-w-[220px]">{a.email || a.contact_email || '—'}</div>
                        <div className="text-xs text-gray-500">{a.phone || a.whatsapp_number || '—'}</div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={a.approval_status} isActive={a.is_active} suspended={!!a.suspended} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(a.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={(e)=>{e.stopPropagation(); router.push(`/agencies/${a.id}`);}} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">View</button>
                          {a.approval_status === 'pending' && (
                            <>
                              <button disabled={approveMut.isPending} onClick={(e)=>{e.stopPropagation(); approveMut.mutate(a.id);}} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                              <button disabled={rejectMut.isPending} onClick={(e)=>{e.stopPropagation(); const r=prompt('Rejection reason (required)'); if(r) rejectMut.mutate({id:a.id, reason:r});}} className="rounded-lg bg-white border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Reject</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <div className="text-sm text-gray-600">Page {page} of {totalPages} · {data?.total} total</div>
                <div className="flex gap-2">
                  <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">Prev</button>
                  <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
