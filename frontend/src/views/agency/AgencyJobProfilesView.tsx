'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { agencyApi } from '@/services/agency-api';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function AgencyJobProfilesView(){
  const qc=useQueryClient();
  const { data: squad=[] } = useQuery({queryKey:['agencySquad'], queryFn: agencyApi.listSquad});
  const { data: memberProfiles=[] } = useQuery({queryKey:['agencyMemberProfiles'], queryFn: agencyApi.listMemberProfiles});
  const { data: categories=[] } = useQuery({queryKey:['agencyCategories'], queryFn: async()=>{ const {data}=await api.get('/public/categories'); return data; }});
  const [form,setForm]=useState({ squad_member_id:'', category_id:'' });
  const create=useMutation({
    mutationFn:()=>agencyApi.createMemberProfile({ squad_member_id: form.squad_member_id, category_id: form.category_id }),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['agencyMemberProfiles']}); toast.success('Job profile created'); },
    onError:(e:any)=>toast.error(e.response?.data?.message||'Failed — check you picked member & category')
  });
  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-content">
          <div className="mb-2"><span className="eyebrow-rainbow">{memberProfiles.length} profiles</span></div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">Job profiles <span className="text-rainbow">per squad member</span>.</h1>
          <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">Same as talent job profiles — pick a squad member and a category. Each member can have multiple categories.</p>
        </div>
      </section>

      <Card className="p-6 sm:p-8">
        <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">Create Job Profile</h2>
        <p className="mt-1 text-sm text-[#737373]">Connects to any squad member — like talents do for themselves.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Select label="Squad Member" value={form.squad_member_id} onChange={e=>setForm(p=>({...p, squad_member_id:e.target.value}))} placeholder="Select member" options={squad.map((m:any)=>({label: m.full_name, value: m.id}))} />
          <Select label="Category" value={form.category_id} onChange={e=>setForm(p=>({...p, category_id:e.target.value}))} placeholder="Select category" options={(categories as any[]).map((c:any)=>({label:c.name, value:c.id}))} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={()=>create.mutate()} loading={create.isPending} disabled={!form.squad_member_id || !form.category_id}>Create Profile</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {memberProfiles.length===0 && <Card className="p-6 text-sm text-[#737373]">No job profiles yet. Pick a member and category above.</Card>}
        {memberProfiles.map((p:any)=>(
          <Card key={p.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#0a0a0a] truncate">Member: {(squad.find((m:any)=>m.id===p.squad_member_id) as any)?.full_name || p.squad_member_id.slice(0,8)} • Category: {(p.category as any)?.name || p.category_id.slice(0,8)}</div>
              <div className="text-xs text-[#737373]">Status: {p.status} • {new Date(p.created_at).toLocaleDateString()}</div>
            </div>
            <Button variant="outline" size="sm" onClick={async()=>{ await agencyApi.deleteMemberProfile(p.id); qc.invalidateQueries({queryKey:['agencyMemberProfiles']}); toast.success('Deleted'); }}>Delete</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
