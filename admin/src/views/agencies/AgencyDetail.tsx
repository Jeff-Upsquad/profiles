'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';

interface Props { id: string }

function Badge({ children, variant='gray' }: { children: React.ReactNode; variant?: 'green'|'amber'|'red'|'gray'|'indigo' }) {
  const m: Record<string,string> = { green:'bg-emerald-100 text-emerald-700 border-emerald-200', amber:'bg-amber-100 text-amber-800 border-amber-200', red:'bg-red-100 text-red-700 border-red-200', gray:'bg-gray-100 text-gray-700 border-gray-200', indigo:'bg-indigo-50 text-indigo-700 border-indigo-200' };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${m[variant]}`}>{children}</span>;
}

export default function AgencyDetail({ id }: Props) {
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [dupEmail, setDupEmail] = useState('');
  const [dupPhone, setDupPhone] = useState('');
  const [liveDup, setLiveDup] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['agency', id],
    queryFn: async () => (await api.get(`/admin/agencies/${id}`)).data,
  });

  const approveMut = useMutation({
    mutationFn: async () => (await api.patch(`/admin/agencies/${id}/approve`)).data,
    onSuccess: () => { toast.success('Agency approved'); qc.invalidateQueries({ queryKey: ['agency', id]}); qc.invalidateQueries({ queryKey: ['agency-stats']}); qc.invalidateQueries({ queryKey: ['agencies']}); },
    onError: (e:any) => toast.error(e.response?.data?.message || 'Approve failed'),
  });
  const rejectMut = useMutation({
    mutationFn: async () => (await api.patch(`/admin/agencies/${id}/reject`, { reason })).data,
    onSuccess: () => { toast.success('Agency rejected'); setRejectOpen(false); setReason(''); qc.invalidateQueries({ queryKey: ['agency', id]}); },
    onError: (e:any) => toast.error(e.response?.data?.message || 'Reject failed'),
  });
  const suspendMut = useMutation({
    mutationFn: async (suspend: boolean) => (await api.patch(`/admin/agencies/${id}/suspend`, { suspend, reason: suspend ? 'Admin action' : null })).data,
    onSuccess: (d:any) => { toast.success(d.message); qc.invalidateQueries({ queryKey: ['agency', id]}); },
    onError: (e:any)=>toast.error(e.response?.data?.message||'Failed'),
  });
  const activeMut = useMutation({
    mutationFn: async (is_active: boolean) => (await api.patch(`/admin/agencies/${id}/active`, { is_active })).data,
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['agency', id]}); },
  });
  const deleteMut = useMutation({
    mutationFn: async () => (await api.delete(`/admin/agencies/${id}`)).data,
    onSuccess: () => { toast.success('Deleted'); window.location.href='/agencies'; },
    onError: (e:any)=>toast.error(e.response?.data?.message||'Delete failed'),
  });
  const updateMut = useMutation({
    mutationFn: async () => (await api.put(`/admin/agencies/${id}`, editForm)).data,
    onSuccess: () => { toast.success('Saved'); setEditOpen(false); qc.invalidateQueries({ queryKey: ['agency', id]}); },
    onError: (e:any)=>toast.error(e.response?.data?.message||'Save failed'),
  });

  const doLiveCheck = async () => {
    if (!dupEmail && !dupPhone) { toast.error('Enter email or phone'); return; }
    setLiveLoading(true);
    try {
      const { data } = await api.post('/admin/agencies/check-duplicate', { email: dupEmail || undefined, phone: dupPhone || undefined, exclude_id: id });
      setLiveDup(data);
    } catch (e:any) { toast.error(e.response?.data?.message || 'Check failed'); }
    finally { setLiveLoading(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" /></div>;
  if (!data) return <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-600">Agency not found</div>;

  const a = data.agency;
  const profile = data.profile;
  const squad: any[] = data.squad_members ?? [];
  const memberProfiles: any[] = data.member_profiles ?? [];
  const general: any[] = data.general_portfolios ?? [];
  const items: any[] = data.portfolio_items ?? [];
  const dups: any[] = data.duplicates ?? [];

  const grouped: Record<string, any[]> = {};
  for (const d of dups) { (grouped[d.source] ??= []).push(d); }

  return (
    <div className="space-y-6">
      <Link href="/agencies" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">← Back to Agencies</Link>

      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-xl font-bold text-white shadow-sm">
              {(a.agency_name?.[0] ?? 'A').toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">{a.agency_name} {a.agency_short_name && <span className="text-sm font-medium text-gray-500">({a.agency_short_name})</span>}</h1>
              {profile?.tagline && <p className="text-sm text-gray-600">{profile.tagline}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={a.approval_status==='approved'?'green':a.approval_status==='pending'?'amber':'red'}>{a.approval_status}</Badge>
                {a.is_active ? <Badge variant="green">Active</Badge> : <Badge>Inactive</Badge>}
                {a.suspended && <Badge variant="red">Suspended</Badge>}
                {a.blacklisted && <Badge variant="red">Blacklisted</Badge>}
                <span className="text-xs text-gray-500">Joined {formatDate(a.created_at)}</span>
              </div>
              {a.approval_status==='rejected' && a.rejection_reason && <p className="mt-2 text-sm text-red-600">Reason: {a.rejection_reason}</p>}
              {dups.length>0 && <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">⚠ {dups.length} duplicate(s) detected — review before approving</div>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.approval_status==='pending' && (
              <>
                <button onClick={()=>approveMut.mutate()} disabled={approveMut.isPending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                <button onClick={()=>setRejectOpen(true)} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Reject</button>
              </>
            )}
            <button onClick={()=>{ setEditForm({ agency_name:a.agency_name, agency_short_name:a.agency_short_name||'', contact_person:a.contact_person||'', email:a.email||'', contact_email:a.contact_email||'', phone:a.phone||'', whatsapp_number:a.whatsapp_number||'', website:a.website||'', location:a.location||'', description:a.description||''}); setEditOpen(true);}} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200"><div className="text-xs uppercase tracking-wider text-gray-500">Squad</div><div className="text-xl font-bold text-gray-900">{squad.length}</div><div className="text-xs text-gray-500">members</div></div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200"><div className="text-xs uppercase tracking-wider text-gray-500">Job profiles</div><div className="text-xl font-bold text-gray-900">{memberProfiles.length}</div><div className="text-xs text-gray-500">linked</div></div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200"><div className="text-xs uppercase tracking-wider text-gray-500">General</div><div className="text-xl font-bold text-gray-900">{general.length}</div><div className="text-xs text-gray-500">portfolios</div></div>
          <div className="rounded-xl bg-gray-50 px-4 py-3 border border-gray-200"><div className="text-xs uppercase tracking-wider text-gray-500">Portfolio items</div><div className="text-xl font-bold text-gray-900">{items.length}</div><div className="text-xs text-gray-500">uploads</div></div>
        </div>
      </div>

      {/* Duplicate panel */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">Duplicate check <span className="text-xs font-normal text-gray-500">— email & phone exist across talent, business, agency, leads</span></h2>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${dups.length ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{dups.length ? `${dups.length} found` : 'No duplicates'}</span>
        </div>
        <div className="p-6 space-y-4">
          {dups.length ? (
            <div className="space-y-3">
              {Object.entries(grouped).map(([src, rows]: any) => (
                <div key={src} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-800 mb-1.5">{src} — {rows.length} match{rows.length>1?'es':''}</div>
                  <div className="space-y-1">
                    {rows.map((r:any, i:number)=> (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-900">{r.display_name || r.record_id}</span>
                        <span className="text-xs text-gray-600">matched on {r.matched_field} · {r.record_id.slice(0,8)}…</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No existing records share this agency&apos;s email or phone. Safe to approve.</p>
          )}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">Live checker — test any email/phone before approving</div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={dupEmail} onChange={e=>setDupEmail(e.target.value)} placeholder="email to check" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <input value={dupPhone} onChange={e=>setDupPhone(e.target.value)} placeholder="phone to check" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <button onClick={doLiveCheck} disabled={liveLoading} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-60">{liveLoading?'Checking…':'Check'}</button>
            </div>
            {liveDup && (
              <div className="mt-3">
                {liveDup.exists ? (
                  <div className="rounded-lg border border-amber-200 bg-white p-3">
                    <div className="text-xs font-semibold text-amber-800">Found {liveDup.duplicates.length} duplicate(s) · sources: {liveDup.sources?.join(', ')}</div>
                    <ul className="mt-1.5 space-y-1">
                      {liveDup.duplicates.map((d:any,i:number)=>(<li key={i} className="text-sm text-gray-700">{d.source} · {d.field} · {d.name} <span className="text-xs text-gray-500">({d.id.slice(0,8)})</span></li>))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No duplicates — email/phone is unique.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4"><h2 className="text-sm font-semibold text-gray-900">Agency profile</h2></div>
          <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <Field label="Agency name" value={a.agency_name} />
            <Field label="Short name" value={a.agency_short_name} />
            <Field label="Contact person" value={a.contact_person} />
            <Field label="Email" value={a.email} />
            <Field label="Contact email" value={a.contact_email} />
            <Field label="Phone" value={a.phone} />
            <Field label="WhatsApp" value={a.whatsapp_number} />
            <Field label="Website" value={a.website} link />
            <Field label="Location" value={a.location} />
            <Field label="Address" value={profile?.address} full />
            <Field label="Pincode" value={profile?.pincode} />
            <Field label="About" value={profile?.about || a.description} full />
            <Field label="Tagline" value={profile?.tagline} full />
            <Field label="Founded" value={profile?.founded_year} />
            <Field label="Team size" value={profile?.team_size} />
            <Field label="Services" value={Array.isArray(profile?.services)?profile.services.join(', '):profile?.services} full />
            <Field label="Industries" value={Array.isArray(profile?.industries)?profile.industries.join(', '):profile?.industries} full />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4"><h2 className="text-sm font-semibold text-gray-900">Admin actions</h2></div>
          <div className="p-4 space-y-3">
            <button onClick={()=>activeMut.mutate(!a.is_active)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{a.is_active?'Mark inactive':'Mark active'}</button>
            <button onClick={()=>suspendMut.mutate(!a.suspended)} className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${a.suspended?'bg-gray-900 text-white':'border border-amber-300 bg-white text-amber-700 hover:bg-amber-50'}`}>{a.suspended?'Unsuspend':'Suspend'}</button>
            <button onClick={()=>{ if(confirm('Blacklist this agency? It will be blocked from new opportunities.')) { const r=prompt('Reason (optional)'); api.patch(`/admin/agencies/${id}/blacklist`, { blacklist: !a.blacklisted, reason: r }).then(()=>{toast.success('Updated'); qc.invalidateQueries({queryKey:['agency',id]});}).catch((e:any)=>toast.error(e.response?.data?.message||'Failed')); } }} className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${a.blacklisted?'bg-gray-900 text-white':'border border-red-200 bg-white text-red-600 hover:bg-red-50'}`}>{a.blacklisted?'Unblacklist':'Blacklist'}</button>
            <button onClick={()=>{ if(confirm('Delete this agency permanently? This cannot be undone.')) deleteMut.mutate(); }} className="w-full rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">Delete agency</button>
            <p className="text-xs text-gray-500">Suspension/blacklist blocks new opportunities but keeps existing data intact.</p>
          </div>
        </div>
      </div>

      {/* Squad */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-gray-900">Squad members · {squad.length}</h2><span className="text-xs text-gray-500">{squad.filter((s:any)=>s.status==='active').length} active</span></div>
        {squad.length===0 ? <div className="p-8 text-center text-sm text-gray-500">No squad members added yet.</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th><th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Role</th><th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Email / Phone</th><th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Status</th><th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Joined</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {squad.map((m:any)=>(
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.role_title || '—'} {m.role_type && <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700">{m.role_type}</span>}</td>
                    <td className="px-4 py-3 text-sm text-gray-600"><div className="truncate max-w-[220px]">{m.email||m.invite_email||'—'}</div><div className="text-xs text-gray-500">{m.phone||'—'}</div></td>
                    <td className="px-4 py-3"><Badge variant={m.status==='active'?'green':m.status==='invited'?'amber':'gray'}>{m.status||'active'}</Badge></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Portfolios */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-3"><h3 className="text-sm font-semibold text-gray-900">Member job profiles · {memberProfiles.length}</h3></div>
          {memberProfiles.length===0 ? <div className="p-6 text-sm text-gray-500">No job profiles yet.</div> : (
            <div className="divide-y divide-gray-100">
              {memberProfiles.map((p:any)=>(
                <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                  <div><div className="text-sm font-medium text-gray-900">{p.category?.name || p.category_id.slice(0,8)}</div><div className="text-xs text-gray-500">member {p.squad_member_id.slice(0,8)} · {Object.keys(p.field_data||{}).length} fields</div></div>
                  <Badge variant={p.status==='approved'?'green':p.status==='pending_review'?'amber':'gray'}>{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-3"><h3 className="text-sm font-semibold text-gray-900">General portfolios · {general.length}</h3></div>
          {general.length===0 ? <div className="p-6 text-sm text-gray-500">No general portfolios yet.</div> : (
            <div className="divide-y divide-gray-100">
              {general.map((p:any)=>(
                <div key={p.id} className="px-6 py-3 flex items-center justify-between">
                  <div><div className="text-sm font-medium text-gray-900">{p.category?.name || p.category_id.slice(0,8)}</div><div className="text-xs text-gray-500">{Object.keys(p.field_data||{}).length} fields</div></div>
                  <Badge variant={p.status==='approved'?'green':p.status==='pending_review'?'amber':'gray'}>{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {items.length>0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-3"><h3 className="text-sm font-semibold text-gray-900">Portfolio items · {items.length}</h3></div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it:any)=>(
              <div key={it.id} className="rounded-lg border border-gray-200 p-3">
                <div className="text-sm font-medium text-gray-900 truncate">{it.title || it.file_name || 'Untitled'}</div>
                <div className="text-xs text-gray-500 truncate">{it.file_type || it.source_type} {it.category_name && `· ${it.category_name}`} {it.skill_name && `· ${it.skill_name}`}</div>
                {it.file_url && <a href={it.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Open file</a>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Reject agency</h3>
            <p className="text-sm text-gray-500">Provide a reason — it will be stored with the agency.</p>
            <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="Reason for rejection…" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setRejectOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button disabled={!reason.trim() || rejectMut.isPending} onClick={()=>rejectMut.mutate()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">Edit agency</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['agency_name','Agency name'],['agency_short_name','Short name'],['contact_person','Contact person'],['email','Email'],['contact_email','Contact email'],['phone','Phone'],['whatsapp_number','WhatsApp'],['website','Website'],['location','Location'],
              ].map(([k,label])=>(
                <label key={k} className="text-sm">
                  <span className="text-gray-700">{label}</span>
                  <input value={editForm[k]||''} onChange={e=>setEditForm((s:any)=>({...s,[k]:e.target.value}))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
              ))}
              <label className="sm:col-span-2 text-sm"><span className="text-gray-700">Description</span><textarea value={editForm.description||''} onChange={e=>setEditForm((s:any)=>({...s,description:e.target.value}))} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={()=>setEditOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
              <button disabled={updateMut.isPending} onClick={()=>updateMut.mutate()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{updateMut.isPending?'Saving…':'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, link, full }: { label:string; value:any; link?:boolean; full?:boolean }) {
  if (value==null || value==='' ) return <div className={full?'sm:col-span-2':''}><div className="text-xs uppercase tracking-wider text-gray-500">{label}</div><div className="text-sm text-gray-400">—</div></div>;
  return (
    <div className={full?'sm:col-span-2':''}>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      {link && typeof value==='string' && value.startsWith('http') ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline break-all">{value}</a> : <div className="text-sm text-gray-900 break-words">{String(value)}</div>}
    </div>
  );
}
